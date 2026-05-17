const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');
const { parseRelativeTime, extractHashtags, extractMentions, extractTimestamp, identifyMediaType } = require('../parsers/baseParser');


async function closeLoginPopup(page) {
  try {
    await page.evaluate(() => {
      const closeButtons = document.querySelectorAll('button[aria-label="Close"], div[role="dialog"] button, button[role="button"]');
      closeButtons.forEach(btn => btn.click());
      
      const dialog = document.querySelector('div[role="dialog"]');
      if (dialog) {
        dialog.style.display = 'none';
      }
    });
    await page.keyboard.press('Escape');
    await randomDelay(500, 1000);
  } catch (e) {}
}

async function scrapeInstagram(page, companyName) {
  try {
    console.log(`[Instagram] Scraping ${companyName}...`);
    console.log(`[Instagram] Target URL: ${settings.targetUrl}`);
    
    await page.goto(settings.targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(3000, 5000);
    
    await closeLoginPopup(page);
    
    console.log('[Instagram] Trying to scroll page...');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await randomDelay(1000, 2000);
    }
    
    const pageState = await page.evaluate(() => {
      return {
        hasArticles: document.querySelectorAll('article').length,
        hasLoginPrompt: document.body.innerText.includes('Log in') && document.body.innerText.includes('Sign up'),
        title: document.title
      };
    });
    console.log('[Instagram] Page state:', pageState);
    
    const postUrls = await extractPostUrls(page);
    console.log(`[Instagram] Found ${postUrls.length} post URLs`);

    const posts = [];
    const limit = Math.min(postUrls.length, settings.postLimit);

    for (let i = 0; i < limit; i++) {
      console.log(`[Instagram] Scraping post ${i + 1}/${limit}...`);
      try {
        const post = await scrapePost(page, postUrls[i], companyName);
        console.log(`[Instagram] Got post: ${post ? 'yes' : 'no'}`);
        if (post && post.postText.length > 10) {
          posts.push(post);
        }
      } catch (err) {
        console.error(`[Instagram] Error: ${err.message}`);
      }
      await randomDelay(1500, 3000);
    }

    console.log(`[Instagram] Collected ${posts.length} posts`);
    return posts;
  } catch (error) {
    console.log(`[Instagram] Scraping failed: ${error.message}`);
    return [];
  }
}

async function extractPostUrls(page) {
  await randomDelay(3000, 5000);
  await closeLoginPopup(page);
  
  const debugInfo = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/p/"]');
    const allLinks = document.querySelectorAll('a[href]');
    
    return {
      postLinks: Array.from(links).map(a => a.href).slice(0, 30),
      totalLinks: allLinks.length,
      pageTitle: document.title,
      bodyText: document.body.innerText.slice(0, 500)
    };
  });
  
  console.log('[Instagram] Debug - Page title:', debugInfo.pageTitle);
  console.log('[Instagram] Debug - Total links:', debugInfo.totalLinks);
  console.log('[Instagram] Debug - Found post links:', debugInfo.postLinks.length);
  console.log('[Instagram] Debug - Page preview:', debugInfo.bodyText.slice(0, 200));
  
  return [...new Set(debugInfo.postLinks)];
}

async function scrapePost(page, postUrl, companyName) {
  try {
    await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await randomDelay(1500, 2500);
    await closeLoginPopup(page);
    
    const companyLower = companyName.toLowerCase();
    
    const postData = await page.evaluate((company) => {
      const results = { 
        postText: '', 
        postedAt: '', 
        url: window.location.href 
      };
      
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n').filter(line => line.trim());
      
      let foundUsername = false;
      let postTextParts = [];
      let inPostContent = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.toLowerCase() === company || line.toLowerCase() === 'nasa') {
          foundUsername = true;
          inPostContent = true;
          continue;
        }
        
        if (foundUsername && inPostContent) {
          if (line.match(/^\d+[dwmyh]$/i) || line === 'Edited') {
            if (!results.postedAt) results.postedAt = line;
            continue;
          }
          
          if (line.includes('Log in') || line.includes('Sign up') || 
              line.includes('Follow') || line.includes('Privacy') ||
              line.includes('About') || line.includes('Help') ||
              line.includes('Save') || line.includes('Bookmark') ||
              line.includes('Share') || line.includes('Send') ||
              line.length < 3) {
            continue;
          }
          
          if (line.length > 10) {
            postTextParts.push(line);
          }
        }
      }
      
      results.postText = postTextParts.join(' ').slice(0, 500);
      return results;
    }, companyLower);
    
    let postedAt = postData.postedAt;
    if (!postedAt || !postedAt.includes('T')) {
      postedAt = new Date().toISOString();
    }
    
    console.log(`[Instagram] @${companyLower}: ${postData.postText.slice(0, 40)}...`);

    if (postData.postText.length < 10) {
      return null;
    }

    const mediaType = await identifyMediaType(page);
    const hashtags = extractHashtags(postData.postText);
    const mentions = extractMentions(postData.postText);

    return createPostModel({
      postText: postData.postText,
      postedAt,
      mediaType,
      hashtags,
      mentions,
      url: postData.url
    });
  } catch (error) {
    console.log(`[Instagram] Error: ${error.message}`);
    return null;
  }
}

module.exports = { scrapeInstagram, PLATFORMS: PLATFORMS.INSTAGRAM };