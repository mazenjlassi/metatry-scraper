const { chromium } = require('playwright');
const settings = require('../config/settings');

async function launchBrowser() {
  const browser = await chromium.launch({
    headless: settings.headless,
    slowMo: settings.slowMo
  });

  const context = await browser.newContext({
    viewport: settings.viewport,
    userAgent: settings.userAgent,
    locale: 'en-US'
  });

  const page = await context.newPage();
  
  return { browser, context, page };
}

module.exports = { launchBrowser };