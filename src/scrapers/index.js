const { launchBrowser } = require('../utils/browser');
const { createResponse, createResultObject } = require('../models/postModel');
const { scrapeInstagram } = require('./instagramScraper');
const { scrapeFacebook } = require('./facebookScraper');
const { scrapeLinkedIn } = require('./linkedinScraper');

async function scrapeAllPlatforms(accounts, companyName) {
  console.log(`\n=== Starting parallel scrape for ${companyName} ===\n`);
  
  let browser = null;
  
  try {
    const { browser: b, page: basePage } = await launchBrowser();
    browser = b;
    
    const results = await Promise.all([
      runInstagramScrape(basePage, accounts.instagram, companyName),
      runFacebookScrape(basePage, accounts.facebook, companyName),
      runLinkedInScrape(basePage, accounts.linkedin, companyName)
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

async function runInstagramScrape(page, url, companyName) {
  if (!url) {
    console.log('[Instagram] No URL provided, skipping...');
    return createResultObject('instagram', []);
  }
  
  console.log(`[Instagram] Using URL: ${url}`);
  const originalUrl = require('../config/settings').targetUrl;
  require('../config/settings').targetUrl = url;
  
  try {
    const posts = await scrapeInstagram(page, companyName);
    return createResultObject('instagram', posts);
  } catch (error) {
    console.error(`[Instagram] Error: ${error.message}`);
    return createResultObject('instagram', []);
  } finally {
    require('../config/settings').targetUrl = originalUrl;
  }
}

async function runFacebookScrape(page, url, companyName) {
  if (!url) {
    console.log('[Facebook] No URL provided, skipping...');
    return createResultObject('facebook', []);
  }
  
  console.log(`[Facebook] Using URL: ${url}`);
  const originalUrl = require('../config/settings').targetUrl;
  require('../config/settings').targetUrl = url;
  
  try {
    const posts = await scrapeFacebook(page, companyName);
    return createResultObject('facebook', posts);
  } catch (error) {
    console.error(`[Facebook] Error: ${error.message}`);
    return createResultObject('facebook', []);
  } finally {
    require('../config/settings').targetUrl = originalUrl;
  }
}

async function runLinkedInScrape(page, url, companyName) {
  if (!url) {
    console.log('[LinkedIn] No URL provided, skipping...');
    return createResultObject('linkedin', []);
  }
  
  console.log(`[LinkedIn] Using URL: ${url}`);
  const originalUrl = require('../config/settings').targetUrl;
  require('../config/settings').targetUrl = url;
  
  try {
    const posts = await scrapeLinkedIn(page, companyName);
    return createResultObject('linkedin', posts);
  } catch (error) {
    console.error(`[LinkedIn] Error: ${error.message}`);
    return createResultObject('linkedin', []);
  } finally {
    require('../config/settings').targetUrl = originalUrl;
  }
}

module.exports = { scrapeAllPlatforms };