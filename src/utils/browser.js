const { chromium } = require('playwright');
const settings = require('../config/settings');
const fs = require('fs-extra');
const path = require('path');

const sessionDir = path.join(__dirname, '..', 'sessions');

async function loginToInstagram(page) {
  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;

  if (!username || !password) {
    throw new Error('Instagram credentials not found in .env');
  }

  console.log('[Browser] Navigating to Instagram login...');
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle', timeout: 30000 });
  await randomDelay(2000, 3000);

  console.log('[Browser] Entering username...');
  await page.fill('input[name="username"]', username);
  await randomDelay(500, 1000);

  console.log('[Browser] Entering password...');
  await page.fill('input[name="password"]', password);
  await randomDelay(500, 1000);

  console.log('[Browser] Clicking login button...');
  await page.click('button[type="submit"]');
  
  await randomDelay(5000, 8000);

  const currentUrl = page.url();
  console.log('[Browser] URL after login:', currentUrl);

  if (currentUrl.includes('login') || currentUrl.includes('challenge')) {
    console.log('[Browser] Login may require verification - manual intervention needed');
    return false;
  }

  console.log('[Browser] Login successful!');
  return true;
}

async function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
        const hasSessionId = cookies.some(c => c.name === 'sessionid');
        if (hasSessionId) {
          await context.addCookies(cookies);
          console.log('[Browser] Loaded saved session with auth tokens');
        } else {
          console.log('[Browser] Session cookies found but no auth token - will login');
        }
      }
    } catch (e) {
      console.log('[Browser] Error loading session:', e.message);
    }
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

module.exports = { launchBrowser, loginToInstagram };