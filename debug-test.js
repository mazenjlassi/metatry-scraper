const { launchBrowser } = require('./src/utils/browser');
const { scrapeInstagram } = require('./src/scrapers/instagramScraper');
require('dotenv').config();

const settings = require('./src/config/settings');
settings.targetUrl = 'https://www.instagram.com/nasa';

async function test() {
  console.log('Starting test...');
  console.log('Target URL:', settings.targetUrl);
  
  let browser = null;
  try {
    const result = await launchBrowser();
    browser = result.browser;
    const page = result.page;
    
    console.log('Browser launched');
    
    const posts = await scrapeInstagram(page, 'NASA');
    console.log('Posts collected:', posts.length);
    console.log(JSON.stringify(posts, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

test();