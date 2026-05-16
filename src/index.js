const { launchBrowser } = require('./utils/browser');
const { saveJson } = require('./utils/saveJson');
const { scrapeInstagram } = require('./scrapers/instagramScraper');
const settings = require('./config/settings');

async function main() {
  console.log('=== MetaTry Scraper - CLI Mode ===');
  console.log(`Target: ${settings.targetUrl}`);
  console.log(`Post limit: ${settings.postLimit}`);
  console.log('');

  let browser = null;

  try {
    console.log('Launching browser...');
    const { browser: b, page } = await launchBrowser();
    browser = b;

    console.log('Starting scraper...');
    const posts = await scrapeInstagram(page, 'IBM');

    console.log(`\nCollected ${posts.length} posts`);
    
    if (posts.length > 0) {
      const outputPath = await saveJson(posts);
      console.log(`JSON exported to: ${outputPath}`);
    }

    console.log('\n=== Scraping Complete ===');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}

main();