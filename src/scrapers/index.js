const { launchBrowser } = require('../utils/browser');
const { randomDelay } = require('../utils/delays');
const { createResponse, createResultObject } = require('../models/postModel');
const { scrapeInstagram } = require('./instagramScraper');
const { scrapeFacebook } = require('./facebookScraper');
const { scrapeLinkedIn } = require('./linkedinScraper');

async function scrapeAllPlatforms(accounts, companyName) {
  console.log(`\n=== Starting parallel scrape for ${companyName} ===\n`);
  
  let browser = null;
  
  try {
    const { browser: b } = await launchBrowser();
    browser = b;
    
    const results = await Promise.all([
      runPlatformScrape(browser, 'instagram', accounts.instagram, companyName, scrapeInstagram),
      runPlatformScrape(browser, 'facebook', accounts.facebook, companyName, scrapeFacebook),
      runPlatformScrape(browser, 'linkedin', accounts.linkedin, companyName, scrapeLinkedIn)
    ]);
    
    const response = createResponse(companyName, results.filter(r => r.posts.length > 0));
    
    console.log(`\n=== Scrape Complete: ${companyName} ===`);
    console.log(`Total posts collected: ${results.reduce((sum, r) => sum + r.posts.length, 0)}\n`);
    
    return response;
    
  } catch (error) {
    console.error('Error during parallel scrape:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}

async function runPlatformScrape(browser, platform, url, companyName, scraperFn) {
  if (!url) {
    console.log(`[${platform}] No URL provided, skipping...`);
    return createResultObject(platform, []);
  }
  
  console.log(`[${platform}] Using URL: ${url}`);
  
  let page = null;
  try {
    page = await browser.newPage();
    
    const settings = require('../config/settings');
    const originalUrl = settings.targetUrl;
    settings.targetUrl = url;
    
    const posts = await scraperFn(page, companyName);
    
    settings.targetUrl = originalUrl;
    console.log(`[${platform}] Scraped ${posts.length} posts`);
    return createResultObject(platform, posts);
    
  } catch (error) {
    console.log(`[${platform}] Error: ${error.message}`);
    return createResultObject(platform, []);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

module.exports = { scrapeAllPlatforms };