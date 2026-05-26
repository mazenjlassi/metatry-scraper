const { chromium } = require('playwright');
const settings = require('../config/settings');
const fs = require('fs-extra');
const path = require('path');

const sessionDir = path.join(__dirname, '..', 'sessions');

async function isInstagramLoggedIn(page) {
  try {
    return await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      if (text.includes('log in') && text.includes('sign up')) return false;
      return document.querySelector('article') !== null || text.includes('posts');
    });
  } catch (e) {
    return false;
  }
}

async function fillInputWithFallback(page, selectors, value) {
  for (const sel of selectors) {
    try {
      const locator = page.locator(sel);
      const count = await locator.count();
      if (count > 0) {
        await locator.first().fill(value);
        console.log(`[Browser] Filled using selector: ${sel}`);
        return true;
      }
    } catch (e) {
      console.log(`[Browser] Selector '${sel}' failed: ${e.message.slice(0, 60)}`);
    }
  }
  return false;
}

async function loginToInstagram(page, context) {
  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;
  const instagramSessionFile = path.join(sessionDir, 'instagram.json');

  if (await fs.pathExists(instagramSessionFile)) {
    try {
      const cookies = await fs.readJson(instagramSessionFile);
      if (cookies && cookies.length > 0) {
        const hasSessionId = cookies.some(c => c.name === 'sessionid');
        if (hasSessionId) {
          await context.addCookies(cookies);
          console.log('[Browser] Loaded existing Instagram session');
          await page.goto('https://www.instagram.com/', { waitUntil: 'load', timeout: 15000 });
          await randomDelay(2000, 3000);
          if (await isInstagramLoggedIn(page)) {
            console.log('[Browser] Instagram session valid!');
            return true;
          }
          console.log('[Browser] Instagram session expired, logging in...');
        }
      }
    } catch (e) {
      console.log('[Browser] Error loading Instagram session:', e.message);
    }
  }

  if (!username || !password) {
    throw new Error('Instagram credentials not found in .env');
  }

  console.log('[Browser] Navigating to Instagram login...');
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle', timeout: 25000 });
  await randomDelay(2000, 3000);

  const pageUrl = page.url();
  const pageTitle = await page.title();
  console.log(`[Browser] Login page loaded: ${pageUrl} (${pageTitle})`);

  const usernameSelectors = ['input[name="username"]', 'input[type="text"]', 'input[autocomplete="username"]'];
  const filled = await fillInputWithFallback(page, usernameSelectors, username);
  if (!filled) {
    const bodyPreview = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log(`[Browser] Could not find username field! Page text: ${bodyPreview}`);
    return false;
  }
  await randomDelay(500, 1000);

  const passwordSelectors = ['input[name="password"]', 'input[type="password"]', 'input[autocomplete="current-password"]'];
  await fillInputWithFallback(page, passwordSelectors, password);
  await randomDelay(500, 1000);

  console.log('[Browser] Clicking login button...');
  const loginBtn = page.locator('button[type="submit"]');
  if (await loginBtn.count() > 0) {
    await loginBtn.first().click();
  } else {
    await page.keyboard.press('Enter');
  }
  
  await randomDelay(5000, 8000);

  console.log('[Browser] Checking login result...');
  const afterUrl = page.url();
  console.log(`[Browser] URL after login: ${afterUrl}`);

  if (afterUrl.includes('challenge') || afterUrl.includes('suspicious') || afterUrl.includes('recaptcha')) {
    console.log('[Browser] Login blocked by recaptcha/challenge');
    return false;
  }

  if (!(await isInstagramLoggedIn(page))) {
    console.log('[Browser] Login form still visible, waiting longer...');
    await randomDelay(5000, 8000);
    if (!(await isInstagramLoggedIn(page))) {
      const bodyPreview = await page.evaluate(() => document.body.innerText.slice(0, 300));
      console.log(`[Browser] Login failed. Page text: ${bodyPreview}`);
      return false;
    }
  }

  console.log('[Browser] Login successful!');

  try {
    const cookies = await context.cookies();
    await fs.writeJson(instagramSessionFile, cookies);
    console.log('[Browser] Saved Instagram session cookies');
  } catch (e) {
    console.log('[Browser] Error saving Instagram session:', e.message);
  }

  return true;
}

async function loginToFacebook(page, context) {
  const username = process.env.FACEBOOK_USERNAME;
  const password = process.env.FACEBOOK_PASSWORD;
  const facebookSessionFile = path.join(sessionDir, 'facebook-cookies.json');

  // Check for existing session
  if (await fs.pathExists(facebookSessionFile)) {
    try {
      const cookies = await fs.readJson(facebookSessionFile);
      if (cookies && cookies.length > 0) {
        await context.addCookies(cookies);
        console.log('[Browser] Loaded existing Facebook session');
        
        // Verify session works
        await page.goto('https://www.facebook.com/', { waitUntil: 'load', timeout: 10000 });
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
  await page.goto('https://www.facebook.com/login/', { waitUntil: 'networkidle', timeout: 25000 });
  await randomDelay(2000, 3000);

  const pageUrl = page.url();
  const pageTitle = await page.title();
  console.log(`[Browser] Login page loaded: ${pageUrl} (${pageTitle})`);

  console.log('[Browser] Entering email...');
  const emailSelectors = ['#email', 'input[type="text"][name="email"]', 'input[data-testid="royal_email"]', 'input[autocomplete="username"]', 'input[name="email"]'];
  const emailFilled = await fillInputWithFallback(page, emailSelectors, username);
  if (!emailFilled) {
    const bodyPreview = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log(`[Browser] Could not find email field! Page text: ${bodyPreview}`);
    return false;
  }
  await randomDelay(500, 1000);

  console.log('[Browser] Entering password...');
  const passSelectors = ['#pass', 'input[type="password"]', 'input[name="pass"]', 'input[data-testid="royal_pass"]'];
  await fillInputWithFallback(page, passSelectors, password);
  await randomDelay(500, 1000);

  console.log('[Browser] Clicking login button...');
  const btnSelectors = ['button[name="login"]', 'button[type="submit"]', 'input[type="submit"]', 'button[id*="login"]'];
  for (const sel of btnSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0) {
        await btn.click();
        console.log(`[Browser] Clicked button: ${sel}`);
        break;
      }
    } catch (e) {}
  }
  
  console.log('[Browser] Waiting for login...');
  await randomDelay(8000, 12000);

  const afterUrl = page.url();
  console.log('[Browser] URL after login:', afterUrl);

  if (afterUrl.includes('checkpoint') || afterUrl.includes('security')) {
    console.log('[Browser] ========== VERIFICATION NEEDED ==========');
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
    slowMo: settings.slowMo,
    args: [
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const context = await browser.newContext({
    viewport: settings.viewport,
    userAgent: settings.userAgent,
    locale: 'en-US',
    permissions: []
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  context.setDefaultTimeout(15000);

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