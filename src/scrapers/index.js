const { launchBrowser, createPlatformContext, applyStealthPatches } = require('../utils/browser');
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
      await new Promise(r => setTimeout(r, 2000));
      await browser.close().catch(() => {});
      console.log('Browser closed');
    }
  }
}

const PLATFORM_TIMEOUT_MS = 180000;

async function runPlatformScrape(browser, platform, url, companyName, scraperFn) {
  if (!url) {
    console.log(`[${platform}] No URL provided, skipping...`);
    return createResultObject(platform, []);
  }
  
  console.log(`[${platform}] Using URL: ${url}`);
  
  let settled = false;
  const result = await Promise.race([
    doPlatformScrape(browser, platform, url, companyName, scraperFn),
    new Promise(resolve => {
      setTimeout(() => {
        if (!settled) {
          console.log(`[${platform}] Timed out after ${PLATFORM_TIMEOUT_MS}ms`);
          resolve(createResultObject(platform, []));
        }
      }, PLATFORM_TIMEOUT_MS);
    })
  ]);
  settled = true;
  return result;
}

async function doPlatformScrape(browser, platform, url, companyName, scraperFn) {
  let ctx = null;
  let page = null;
  try {
    ctx = await createPlatformContext(browser, platform);
    page = await ctx.newPage();
    
    let posts;
    if (platform === 'facebook') {
      posts = await scraperFn(page, companyName, browser, ctx, url);
    } else if (platform === 'linkedin') {
      posts = await scraperFn(page, companyName, url);
    } else {
      posts = await scraperFn(page, companyName, ctx, url);
    }
    
    console.log(`[${platform}] Scraped ${posts.length} posts`);
    return createResultObject(platform, posts);
    
  } catch (error) {
    console.log(`[${platform}] Error: ${error.message}`);
    return createResultObject(platform, []);
  } finally {
    if (page) await page.close().catch(() => {});
    if (ctx) await ctx.close().catch(() => {});
  }
}

module.exports = { scrapeAllPlatforms };