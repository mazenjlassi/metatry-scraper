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

async function loginToFacebook(page, context) {
  const username = process.env.FACEBOOK_USERNAME;
  const password = process.env.FACEBOOK_PASSWORD;
  const facebookSessionFile = path.join(sessionDir, 'facebook.json');

  // Check for existing session
  if (await fs.pathExists(facebookSessionFile)) {
    try {
      const cookies = await fs.readJson(facebookSessionFile);
      if (cookies && cookies.length > 0) {
        await context.addCookies(cookies);
        console.log('[Browser] Loaded existing Facebook session');
        
        // Verify session works
        await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle', timeout: 15000 });
        await randomDelay(2000, 3000);
        
        const isLoggedIn = await page.evaluate(() => {
          return !document.body.innerText.includes('Connect with friends');
        });
        
        if (isLoggedIn) {
          console.log('[Browser] Facebook session valid!');
          return true;
        }
        console.log('[Browser] Existing session expired, need new login');
      }
    } catch (e) {
      console.log('[Browser] Error loading Facebook session:', e.message);
    }
  }

  if (!username || !password) {
    throw new Error('Facebook credentials not found in .env');
  }

  console.log('[Browser] Navigating to Facebook login...');
  console.log('[Browser] NOTE: Browser is NOT headless - you can handle 2FA manually if needed');
  await page.goto('https://www.facebook.com/login/', { waitUntil: 'networkidle', timeout: 30000 });
  await randomDelay(2000, 3000);

  console.log('[Browser] Entering email...');
  await page.fill('#email', username);
  await randomDelay(500, 1000);

  console.log('[Browser] Entering password...');
  await page.fill('#pass', password);
  await randomDelay(500, 1000);

  console.log('[Browser] Clicking login button...');
  await page.click('button[name="login"]');
  
  console.log('[Browser] Waiting for login... (if 2FA needed, enter code in browser)');
  await randomDelay(10000, 15000);

  const currentUrl = page.url();
  console.log('[Browser] URL after login:', currentUrl);

  if (currentUrl.includes('checkpoint') || currentUrl.includes('security')) {
    console.log('[Browser] ========== VERIFICATION NEEDED ==========');
    console.log('[Browser] Please complete verification in the browser window');
    console.log('[Browser] Waiting 60 seconds for manual verification...');
    await randomDelay(60000, 60000);
    
    const finalUrl = page.url();
    if (!finalUrl.includes('checkpoint') && !finalUrl.includes('security')) {
      console.log('[Browser] Verification completed!');
    } else {
      console.log('[Browser] Verification not completed');
      return false;
    }
  }

  // Save session on success
  try {
    const cookies = await context.cookies();
    await fs.writeJson(facebookSessionFile, cookies);
    console.log('[Browser] Saved Facebook session cookies');
  } catch (e) {}

  console.log('[Browser] Facebook login successful!');
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

  // Load Instagram cookies
  const instagramSessionFile = path.join(sessionDir, 'instagram.json');
  if (await fs.pathExists(instagramSessionFile)) {
    try {
      const cookies = await fs.readJson(instagramSessionFile);
      if (cookies && cookies.length > 0) {
        const hasSessionId = cookies.some(c => c.name === 'sessionid');
        if (hasSessionId) {
          await context.addCookies(cookies);
          console.log('[Browser] Loaded saved Instagram session with auth tokens');
        } else {
          console.log('[Browser] Instagram session cookies found but no auth token - will login');
        }
      }
    } catch (e) {
      console.log('[Browser] Error loading Instagram session:', e.message);
    }
  }

  // Load Facebook cookies
  const facebookCookieFile = path.join(sessionDir, 'facebook-cookies.json');
  if (await fs.pathExists(facebookCookieFile)) {
    try {
      const cookies = await fs.readJson(facebookCookieFile);
      if (cookies && cookies.length > 0) {
        await context.addCookies(cookies);
        console.log('[Browser] Loaded Facebook cookies');
      }
    } catch (e) {
      console.log('[Browser] Error loading Facebook cookies:', e.message);
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

module.exports = { launchBrowser, loginToInstagram, loginToFacebook };