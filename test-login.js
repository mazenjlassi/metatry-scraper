require('dotenv').config();
const { launchBrowser, loginToInstagram } = require('./src/utils/browser');

async function test() {
  console.log('Testing login...');
  const { browser, page } = await launchBrowser();
  
  try {
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Loaded login page');
    
    const username = process.env.INSTAGRAM_USERNAME;
    const password = process.env.INSTAGRAM_PASSWORD;
    
    await page.fill('input[name="username"]', username);
    await page.waitForTimeout(1000);
    await page.fill('input[name="password"]', password);
    await page.waitForTimeout(1000);
    
    console.log('Filled credentials');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(8000);
    
    console.log('After login URL:', page.url());
    
    const cookies = await page.context().cookies();
    console.log('Cookies:', cookies.map(c => c.name));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

test();