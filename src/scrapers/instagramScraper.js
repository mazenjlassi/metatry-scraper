const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');
const { parseEngagementNumber, parseRelativeTime, extractHashtags, extractMentions, identifyMediaType, extractTimestamp } = require('../parsers/baseParser');

async function scrapeInstagram(page, companyName) {
  try {
    console.log(`[Instagram] Scraping ${companyName}...`);
    
    await page.goto(settings.targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(2000, 4000);

    const postUrls = await extractPostUrls(page);
    console.log(`[Instagram] Found ${postUrls.length} post URLs`);

    const posts = [];
    const limit = Math.min(postUrls.length, settings.postLimit);

    for (let i = 0; i < limit; i++) {
      console.log(`[Instagram] Scraping post ${i + 1}/${limit}...`);
      try {
        const post = await scrapePost(page, postUrls[i], companyName);
        if (post && post.postText.length > 10) {
          posts.push(post);
        }
      } catch (err) {
        console.error(`[Instagram] Error scraping post ${i + 1}: ${err.message}`);
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
  
  const urls = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/p/"]');
    return Array.from(links).map(a => a.href).slice(0, 30);
  });

  return [...new Set(urls)];
}

async function scrapePost(page, postUrl, companyName) {
  await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 15000 });
  await randomDelay(1500, 2500);

  const companyLower = companyName.toLowerCase();
  
  const postData = await page.evaluate((company) => {
    const results = { 
      postText: '', 
      likes: '0', 
      comments: '0', 
      shares: '0',
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
      
      if (!foundUsername && line.toLowerCase() === company) {
        foundUsername = true;
        inPostContent = true;
        continue;
      }
      
      if (foundUsername && inPostContent) {
        if (line.match(/^\d+[dwmyh]$/i) || line === 'Edited') {
          if (!results.postedAt) results.postedAt = line;
          continue;
        }
        
        if (line.includes('like') && line.match(/\d+/)) {
          const likeMatch = line.match(/([\d,.]+[KM]?)\s*like/i);
          if (likeMatch) results.likes = likeMatch[1];
          continue;
        }
        
        if (line.includes('reply') && line.match(/\d+\s*like/)) {
          continue;
        }
        
        if (line.includes('Log in') || line.includes('Sign up') || 
            line.includes('Follow') || line.includes('Privacy') ||
            line.includes('About') || line.includes('Help') ||
            line.length < 3) {
          continue;
        }
        
        if (line.length > 10) {
          postTextParts.push(line);
        }
      }
    }
    
    results.postText = postTextParts.join(' ').slice(0, 500);
    
    const spanElements = document.querySelectorAll('span');
    const numberValues = [];
    for (const span of spanElements) {
      const text = span.innerText?.trim() || '';
      if (text.match(/^[\d,.]+[KMB]?$/)) {
        numberValues.push(text);
      }
    }
    
    const likePatterns = ['like', 'Like', 'Likes', 'likes'];
    for (const span of spanElements) {
      const text = span.innerText?.trim() || '';
      if (likePatterns.some(p => text.includes(p)) && /\d/.test(text)) {
        const match = text.match(/([\d,.]+[KMB]?)\s*like/i);
        if (match && results.likes === '0') {
          results.likes = match[1];
        }
      }
    }
    
    if (results.likes === '0' && numberValues.length > 0) {
      const likeValue = numberValues.find(v => v.match(/[KMB]/i));
      if (likeValue) results.likes = likeValue;
      else if (numberValues[0]) results.likes = numberValues[0];
    }
    
    if (numberValues.length > 1) {
      const nonLikeValues = numberValues.filter(v => !v.match(/[KMB]/i));
      if (nonLikeValues.length > 0) {
        results.comments = nonLikeValues[0];
      }
    }
    
    const shareButtons = document.querySelectorAll('button, a');
    for (const btn of shareButtons) {
      const text = btn.innerText?.toLowerCase() || '';
      if (text.includes('share') || text.includes('send')) {
        const parent = btn.closest('article') || btn.closest('section');
        if (parent) {
          const shareText = parent.innerText || '';
          const shareMatch = shareText.match(/([\d,.]+[KMB]?)\s*(share|send)/i);
          if (shareMatch) {
            results.shares = shareMatch[1];
          }
        }
        break;
      }
    }
    
    return results;
  }, companyLower);

  let postedAt = postData.postedAt;
  if (!postedAt || !postedAt.includes('T')) {
    const timeAttr = await extractTimestamp(page);
    if (timeAttr && timeAttr.includes('T')) {
      postedAt = timeAttr;
    } else if (timeAttr) {
      postedAt = parseRelativeTime(timeAttr);
    } else {
      postedAt = new Date().toISOString();
    }
  }

  console.log(`[Instagram] @${companyLower}: ${postData.postText.slice(0, 40)}...`);
  console.log(`[Instagram] Likes: ${postData.likes}, Comments: ${postData.comments}, Shares: ${postData.shares}`);

  if (postData.postText.length < 10) {
    return null;
  }

  const mediaType = await identifyMediaType(page);
  const hashtags = extractHashtags(postData.postText);
  const mentions = extractMentions(postData.postText);

  return createPostModel({
    postText: postData.postText,
    likes: parseEngagementNumber(postData.likes),
    comments: parseEngagementNumber(postData.comments),
    shares: parseEngagementNumber(postData.shares),
    postedAt,
    mediaType,
    hashtags,
    mentions,
    url: postData.url
  });
}

module.exports = { scrapeInstagram, PLATFORMS: PLATFORMS.INSTAGRAM };