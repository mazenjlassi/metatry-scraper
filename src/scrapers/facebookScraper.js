const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');
const { parseEngagementNumber, parseRelativeTime, extractHashtags, extractMentions, identifyMediaType, extractTimestamp } = require('../parsers/baseParser');
const { loginToFacebook } = require('../utils/browser');

async function ensureFacebookLoggedIn(page) {
  console.log('[Facebook] Checking login status...');
  
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle', timeout: 15000 });
  await randomDelay(2000, 3000);
  
  const pageUrl = page.url();
  console.log('[Facebook] Current URL:', pageUrl);
  
  const isLoggedIn = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    // Check for login indicators
    const hasLoginForm = document.querySelector('#login_form') !== null;
    const hasLoginButton = document.querySelector('button[name="login"]') !== null;
    const hasConnectText = bodyText.includes('Connect with friends') && bodyText.includes('Create an account');
    return !hasLoginForm && !hasLoginButton && !hasConnectText;
  });
  
  console.log('[Facebook] Is logged in:', isLoggedIn);
  
  if (!isLoggedIn) {
    console.log('[Facebook] Not logged in - performing login...');
    const loginSuccess = await loginToFacebook(page);
    if (!loginSuccess) {
      console.log('[Facebook] Login failed or needs verification');
      return false;
    }
  } else {
    console.log('[Facebook] Already logged in');
  }
  
  return true;
}

async function scrapeFacebookDesktop(page, url) {
  console.log(`[Facebook] Scraping desktop: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await randomDelay(3000, 5000);
  
  // Scroll
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await randomDelay(1500, 2500);
  }
  
  const posts = await extractFacebookPosts(page);
  console.log(`[Facebook] Desktop got: ${posts.length} posts`);
  return posts;
}

async function scrapeFacebookMobile(page, url) {
  const mobileUrl = url.replace('www.facebook.com', 'm.facebook.com');
  console.log(`[Facebook] Scraping mobile: ${mobileUrl}`);
  await page.goto(mobileUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await randomDelay(3000, 5000);
  
  // Scroll
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await randomDelay(1500, 2500);
  }
  
  const posts = await extractFacebookPosts(page);
  console.log(`[Facebook] Mobile got: ${posts.length} posts`);
  return posts;
}

async function scrapeFacebookVideos(page, url) {
  const videosUrl = url.replace(/\/$/, '') + '/videos/';
  console.log(`[Facebook] Scraping videos: ${videosUrl}`);
  try {
    await page.goto(videosUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(3000, 5000);
    
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await randomDelay(1000, 1500);
    }
    
    const posts = await extractFacebookPosts(page);
    console.log(`[Facebook] Videos got: ${posts.length} posts`);
    return posts;
  } catch (e) {
    console.log(`[Facebook] Videos page failed: ${e.message}`);
    return [];
  }
}

async function scrapeFacebook(page, companyName) {
  try {
    console.log(`[Facebook] Scraping ${companyName}...`);
    
    let targetUrl = settings.targetUrl;
    console.log(`[Facebook] Target URL: ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(3000, 5000);
    
    console.log('[Facebook] Scrolling...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await randomDelay(1500, 2500);
    }
    
    const posts = await extractFacebookPosts(page);
    console.log(`[Facebook] Collected ${posts.length} posts`);
    
    const validPosts = [];
    const seenTexts = new Set();
    const skipTexts = ['nasa -', 'informations de compte', 'national aeronautics', 'space administration'];
    
    for (const post of posts) {
      if (!post.url || post.url.length < 10) continue;
      const text = (post.postText || '').toLowerCase();
      if (skipTexts.some(t => text.includes(t))) continue;
      const key = text.slice(0, 30);
      if (seenTexts.has(key)) continue;
      if (validPosts.length < 10) {
        validPosts.push(post);
        seenTexts.add(key);
      }
    }
    
    console.log(`[Facebook] Final: ${validPosts.length} posts`);
    return validPosts;
  } catch (error) {
    console.log(`[Facebook] Scraping failed: ${error.message}`);
    return [];
  }
}

function filterAndLimitPosts(posts, limit) {
  const validPosts = [];
  const seenTexts = new Set();
  const skipTexts = ['nasa -', 'informations de compte', 'national aeronautics', 'space administration', 'followers', 'suivi'];
  
  for (const post of posts) {
    // Skip posts without valid URL (not real posts)
    if (!post.url || post.url.length < 10) {
      continue;
    }
    
    const text = (post.postText || '').toLowerCase();
    const isGarbage = skipTexts.some(t => text.includes(t.toLowerCase()));
    
    // Skip duplicates by text content
    const textKey = text.slice(0, 30);
    if (seenTexts.has(textKey) || isGarbage) {
      continue;
    }
    
    if (validPosts.length < limit) {
      validPosts.push(post);
      seenTexts.add(textKey);
    }
  }
  
  return validPosts;
}

async function extractFacebookPosts(page) {
  await randomDelay(2000, 3000);

  const postsData = await page.evaluate(() => {
    const results = [];
    const selectors = [
      'article',
      '[role="article"]',
      'div[aria-label*="Post"]',
      'div[data-pagelet*="FeedUnit"]',
      'div.x1n2onr6',
      'div[aria-labelledby]',
      'div[data-sigil="feed-story"]',
      'div.story',
      'section[data-sigil]',
      'div.user-content'
    ];
    
    let articles = [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => articles.push(el));
    });
    articles = [...new Set(articles)];
    
    const uiWords = ['Follow', 'Like', 'Comment', 'Share', 'See more', 'See earlier', 'Learn more', 'Send', 'Save', 'Report', 'follow', 'like', 'comment', 'share'];
    
    for (const article of articles) {
      try {
        const post = {
          postText: '',
          postedAt: '',
          url: ''
        };
        
        const textContent = article.innerText;
        const lines = textContent.split('\n').filter(l => l.trim());
        
        let foundContent = false;
        let contentLines = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.match(/^\d+[smhdw]/i) || line.match(/^[A-Z][a-z]+\s\d{1,2},?\s\d{4}/)) {
            if (!post.postedAt) post.postedAt = line;
            continue;
          }
          
          const isUiWord = uiWords.some(w => line === w || line.startsWith(w + ' ') || line.endsWith(' ' + w));
          if (isUiWord || line.includes(' · ')) continue;
          
          if (line.length > 25 && !line.match(/^\d+$/)) {
            if (!foundContent) {
              contentLines.push(line);
              foundContent = true;
            }
          }
        }
        
        post.postText = contentLines.join(' ').slice(0, 600);
        
        // Skip if looks like page header (very short, no lowercase letters)
        if (post.postText.length > 0 && post.postText.length < 65 && post.postText === post.postText.toUpperCase()) {
          continue;
        }
        
        const link = article.querySelector('a[href*="/posts/"], a[href*="/story"], a[href*="/photo/"]');
        if (link) post.url = link.href;
        
        const timeEl = article.querySelector('time');
        if (timeEl) {
          const datetime = timeEl.getAttribute('datetime');
          if (datetime) post.postedAt = datetime;
        }
        
        if (post.postText.length > 20) {
          results.push(post);
        }
      } catch (e) {
        continue;
      }
    }
    
    return results.slice(0, 30);
  });
  
  // Filter garbage posts - now with detailed logging
  console.log('[Facebook] Raw posts from browser:', postsData.length);
  
  const filteredPosts = [];
  const seenKeys = new Set();
  
console.log('[Facebook] Total posts to filter:', postsData.length);
  
  // Take first 5 valid posts with deduplication
  const validPosts = [];
  const seenTexts = new Set();
  const skipTexts = ['nasa -', 'informations de compte', 'national aeronautics', 'space administration'];
  
  for (const post of postsData) {
    // Skip posts without valid URL (not real posts)
    if (!post.url || post.url.length < 10) {
      console.log(`[Facebook] Skipped: no valid URL`);
      continue;
    }
    
    const text = (post.postText || '').toLowerCase();
    const isGarbage = skipTexts.some(t => text.includes(t.toLowerCase()));
    
    // Skip duplicates by text content
    const textKey = text.slice(0, 30);
    if (seenTexts.has(textKey)) {
      console.log(`[Facebook] Skipped: duplicate`);
      continue;
    }
    
    if (!isGarbage && validPosts.length < 5) {
      validPosts.push(post);
      seenTexts.add(textKey);
      console.log(`[Facebook] Kept: "${post.postText?.slice(0,40)}..."`);
    }
  }
  
  console.log('[Facebook] Filtered to:', validPosts.length, 'posts');
  
  const finalPostsData = validPosts.slice(0, 5);

  const posts = [];
  for (const postData of finalPostsData.slice(0, settings.postLimit)) {
    let postedAt = postData.postedAt;
    if (postedAt && !postedAt.includes('T')) {
      postedAt = parseRelativeTime(postedAt);
    } else if (!postedAt) {
      postedAt = new Date().toISOString();
    }

    const hashtags = extractHashtags(postData.postText);
    const mentions = extractMentions(postData.postText);
    
    posts.push(createPostModel({
      postText: postData.postText,
      postedAt,
      mediaType: 'post',
      hashtags,
      mentions,
      url: postData.url
    }));
  }

  return posts;
}

module.exports = { scrapeFacebook, PLATFORMS: PLATFORMS.FACEBOOK };