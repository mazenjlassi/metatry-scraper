const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel } = require('../models/postModel');
const { parseEngagementNumber, parseRelativeTime, extractHashtags, identifyMediaType } = require('../parsers/instagramParser');

async function scrapeInstagram(page) {
  console.log(`Navigating to ${settings.targetUrl}...`);
  await page.goto(settings.targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await randomDelay(2000, 4000);

  const postUrls = await extractPostUrls(page);
  console.log(`Found ${postUrls.length} post URLs`);

  const posts = [];
  const limit = Math.min(postUrls.length, settings.postLimit);

  for (let i = 0; i < limit; i++) {
    console.log(`Scraping post ${i + 1}/${limit}...`);
    try {
      const post = await scrapePost(page, postUrls[i]);
      if (post && post.postText.length > 10) {
        posts.push(post);
      } else {
        console.log(`  - Skipped (invalid post)`);
      }
    } catch (err) {
      console.error(`Error scraping post ${i + 1}: ${err.message}`);
    }
    await randomDelay(1500, 3000);
  }

  return posts;
}

async function extractPostUrls(page) {
  await randomDelay(3000, 5000);
  
  const urls = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/p/"]');
    const bodyText = document.body.innerText.slice(0, 500);
    return { 
      urls: Array.from(links).map(a => a.href).slice(0, 20),
      bodyPreview: bodyText
    };
  });

  console.log(`  - Page preview: ${urls.bodyPreview.slice(0, 100)}...`);
  console.log(`  - Found ${urls.urls.length} post links`);
  
  return [...new Set(urls.urls)];
}

async function scrapePost(page, postUrl) {
  await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 15000 });
  await randomDelay(1500, 2500);

  const postData = await page.evaluate(() => {
    const results = { postText: '', likes: '0', comments: '0', postedAt: '', username: '' };
    
    const bodyText = document.body.innerText;
    const lines = bodyText.split('\n').filter(line => line.trim());
    
    let foundUsername = false;
    let postTextParts = [];
    let inPostContent = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!foundUsername && line.toLowerCase() === 'ibm') {
        results.username = 'ibm';
        foundUsername = true;
        inPostContent = true;
        
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.match(/^\d+[dwmyh]$/i) || nextLine === 'Edited') {
            results.postedAt = new Date().toISOString();
          }
        }
        continue;
      }
      
      if (foundUsername && inPostContent) {
        if (line.match(/^\d+[dwmyh]$/i) || line === 'Edited') {
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
    
    return results;
  });

  console.log(`  - @${postData.username}: ${postData.postText.slice(0, 40)}...`);
  console.log(`  - Likes: ${postData.likes}, Comments: ${postData.comments}`);

  if (!postData.username || postData.postText.length < 10) {
    console.log(`  - Skipped (no valid data)`);
    return null;
  }

  const mediaType = await identifyMediaType(page);
  const hashtags = extractHashtags(postData.postText);

  return createPostModel({
    platform: settings.platform,
    company: settings.company,
    postText: postData.postText,
    likes: parseEngagementNumber(postData.likes),
    comments: parseEngagementNumber(postData.comments),
    shares: 0,
    postedAt: postData.postedAt,
    mediaType,
    hashtags
  });
}

module.exports = { scrapeInstagram };