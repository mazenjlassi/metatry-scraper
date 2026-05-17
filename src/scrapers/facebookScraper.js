const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');
const { parseEngagementNumber, parseRelativeTime, extractHashtags, extractMentions, identifyMediaType, extractTimestamp } = require('../parsers/baseParser');

async function scrapeFacebook(page, companyName) {
  try {
    let targetUrl = settings.targetUrl;
    
    // Try /posts/ endpoint for more content
    if (!targetUrl.endsWith('/posts/') && !targetUrl.includes('/posts?')) {
      targetUrl = targetUrl.replace(/\/$/, '') + '/posts/';
      console.log(`[Facebook] Using posts endpoint: ${targetUrl}`);
    }
    
    console.log(`[Facebook] Scraping ${companyName}...`);
    console.log(`[Facebook] Target URL: ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(3000, 5000);
    
    // Check if we got login prompt - if so, try mobile
    const needsLogin = await page.evaluate(() => {
      return document.body.innerText.includes('Connect with friends') || 
             document.body.innerText.includes('Create an account');
    });
    
    if (needsLogin && targetUrl.includes('www.facebook.com')) {
      console.log('[Facebook] Desktop version needs login, trying mobile...');
      targetUrl = targetUrl.replace('www.facebook.com', 'm.facebook.com');
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await randomDelay(3000, 5000);
    }

    console.log('[Facebook] Scrolling to load more posts...');
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await randomDelay(2000, 3000);
    }

    const posts = await extractFacebookPosts(page);
    console.log(`[Facebook] Collected ${posts.length} posts`);

    return posts;
  } catch (error) {
    console.log(`[Facebook] Scraping failed: ${error.message}`);
    return [];
  }
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
  
  // Just take first 2 valid posts to avoid garbage
  const validPosts = [];
  const skipTexts = ['nasa -', 'informations de compte', 'national aeronautics', 'space administration'];
  
  for (const post of postsData) {
    // Skip posts without valid URL (not real posts)
    if (!post.url || post.url.length < 10) {
      console.log(`[Facebook] Skipped: no valid URL`);
      continue;
    }
    
    const text = (post.postText || '').toLowerCase();
    const isGarbage = skipTexts.some(t => text.includes(t.toLowerCase()));
    
    if (!isGarbage && validPosts.length < 2) {
      validPosts.push(post);
      console.log(`[Facebook] Kept: "${post.postText?.slice(0,40)}..."`);
    }
  }
  
  console.log('[Facebook] Filtered to:', validPosts.length, 'posts');
  
  const finalPostsData = validPosts.slice(0, 2);

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