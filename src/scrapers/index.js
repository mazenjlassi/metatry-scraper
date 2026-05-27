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
    const { browser: b, context: ctx } = await launchBrowser();
    browser = b;
    
    const results = await Promise.all([
      runPlatformScrape(ctx, browser, 'instagram', accounts.instagram, companyName, scrapeInstagram),
      runPlatformScrape(ctx, browser, 'facebook', accounts.facebook, companyName, scrapeFacebook),
      runPlatformScrape(ctx, browser, 'linkedin', accounts.linkedin, companyName, scrapeLinkedIn)
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

async function runPlatformScrape(ctx, browser, platform, url, companyName, scraperFn) {
  if (!url) {
    console.log(`[${platform}] No URL provided, skipping...`);
    return createResultObject(platform, []);
  }
  
  console.log(`[${platform}] Using URL: ${url}`);
  
  let settled = false;
  const result = await Promise.race([
    doPlatformScrape(ctx, browser, platform, url, companyName, scraperFn),
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

async function doPlatformScrape(ctx, browser, platform, url, companyName, scraperFn) {
  let page = null;
  try {
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
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

module.exports = { scrapeAllPlatforms };