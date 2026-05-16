const { chromium } = require('playwright');
const settings = require('../config/settings');
const fs = require('fs-extra');
const path = require('path');

const sessionDir = path.join(__dirname, '..', 'sessions');

async function launchBrowser() {
  await fs.ensureDir(sessionDir);
  
  const browser = await chromium.launch({
    headless: settings.headless,
    slowMo: settings.slowMo
  });

  const context = await browser.newContext({
    viewport: settings.viewport,
    userAgent: settings.userAgent,
    locale: 'en-US'
  });

  const sessionFile = path.join(sessionDir, 'instagram.json');
  
  if (await fs.pathExists(sessionFile)) {
    try {
      const cookies = await fs.readJson(sessionFile);
      if (cookies && cookies.length > 0) {
        await context.addCookies(cookies);
        console.log('[Browser] Loaded saved session');
      }
    } catch (e) {}
  }

  const page = await context.newPage();
  
  context.on('close', async () => {
    try {
      const cookies = await context.cookies();
      await fs.writeJson(sessionFile, cookies);
      console.log('[Browser] Saved session cookies');
    } catch (e) {}
  });
  
  return { browser, context, page };
}

module.exports = { launchBrowser };