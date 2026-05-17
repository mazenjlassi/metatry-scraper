const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');

const sessionDir = path.join(__dirname, 'sessions');
const sessionFile = path.join(sessionDir, 'instagram.json');

async function main() {
  await fs.ensureDir(sessionDir);
  
  console.log('Opening browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('Loading Instagram login...');
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle', timeout: 30000 });
  
  console.log('Please log in manually...');
  console.log('Waiting for login to complete...');
  
  // Wait for the URL to change to something other than login page
  await page.waitForFunction(() => {
    return !window.location.href.includes('login');
  }, { timeout: 60000 });
  
  console.log('Login detected! URL:', page.url());
  
  // Wait a bit more for session to stabilize
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('Saving session...');
  const cookies = await context.cookies();
  console.log('Cookies count:', cookies.length);
  console.log('Cookie names:', cookies.map(c => c.name).join(', '));
  
  await fs.writeJson(sessionFile, cookies);
  console.log('Session saved to:', sessionFile);
  
  await browser.close();
  console.log('Done! Now run the scraper.');
}

main();