const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');
const { parseEngagementNumber, parseRelativeTime, extractHashtags, extractMentions, identifyMediaType } = require('../parsers/baseParser');
const { loginToFacebook } = require('../utils/browser');

async function scrapeFacebookDesktop(page, url) {
  console.log(`[Facebook] Desktop: ${url}`);
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  await randomDelay(2000, 3000);
  
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await randomDelay(1000, 2000);
  }
  
  const posts = await extractFacebookPosts(page);
  console.log(`[Facebook] Desktop: ${posts.length} posts`);
  return posts;
}

async function scrapeFacebookMobile(page, url) {
  const mobileUrl = url.replace('www.facebook.com', 'm.facebook.com');
  console.log(`[Facebook] Mobile: ${mobileUrl}`);
  try {
    await page.goto(mobileUrl, { waitUntil: 'load', timeout: 15000 });
    await randomDelay(2000, 3000);
    
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await randomDelay(1000, 1500);
    }
    
    const posts = await extractFacebookPosts(page);
    console.log(`[Facebook] Mobile: ${posts.length} posts`);
    return posts;
  } catch (e) {
    console.log(`[Facebook] Mobile failed: ${e.message}`);
    return [];
  }
}

async function scrapeFacebookVideos(page, url) {
  const videosUrl = url.replace(/\/$/, '') + '/videos/';
  console.log(`[Facebook] Videos: ${videosUrl}`);
  try {
    await page.goto(videosUrl, { waitUntil: 'load', timeout: 15000 });
    await randomDelay(2000, 3000);
    
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await randomDelay(1000, 1500);
    }
    
    const posts = await extractFacebookPosts(page);
    console.log(`[Facebook] Videos: ${posts.length} posts`);
    return posts;
  } catch (e) {
    console.log(`[Facebook] Videos failed: ${e.message}`);
    return [];
  }
}

async function scrapeFacebook(page, companyName, browser, ctx, url) {
  try {
    const targetUrl = url.replace('/posts/', '/').replace(/\/$/, '');
    
    console.log(`[Facebook] Scraping ${companyName}...`);
    console.log(`[Facebook] Target: ${targetUrl}`);
    
    console.log('[Facebook] Logging in...');
    await loginToFacebook(page, ctx);
    
    // Scrape all three versions (sequential - same page)
    const desktopPosts = await scrapeFacebookDesktop(page, targetUrl);
    const mobilePosts = await scrapeFacebookMobile(page, targetUrl);
    const videoPosts = await scrapeFacebookVideos(page, targetUrl);
    
    // Combine
    const allPosts = [...desktopPosts, ...mobilePosts, ...videoPosts];
    console.log(`[Facebook] Total before filter: ${allPosts.length} posts`);
    
    // Filter
    const validPosts = filterAndLimitPosts(allPosts, 20);
    
    console.log(`[Facebook] Final: ${validPosts.length} posts`);
    return validPosts;
    
  } catch (error) {
    console.log(`[Facebook] Failed: ${error.message}`);
    return [];
  }
}

function filterAndLimitPosts(posts, limit) {
  const validPosts = [];
  const seenTexts = new Set();
  const skipTexts = [
    'nasa -', 'informations de compte', 'responsable de cette page',
    'dcover plus de contenu', 'trouvez plus de contenu', 'page ·',
    'suivi', 'followers', 'Découvrez plus de contenu'
  ];
  
  for (const post of posts) {
    if (!post.url || post.url.length < 15) continue;
    if (post.url.includes('comment_id=')) continue;
    
    const text = (post.postText || '').toLowerCase();
    const isGarbage = skipTexts.some(t => text.includes(t.toLowerCase()));
    if (isGarbage) continue;
    
    const textKey = text.slice(0, 30);
    if (seenTexts.has(textKey)) continue;
    
    if (validPosts.length < limit) {
      validPosts.push(post);
      seenTexts.add(textKey);
    }
  }
  
  return validPosts;
}

async function extractFacebookPosts(page) {
  await randomDelay(1000, 1500);

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
      try {
        document.querySelectorAll(sel).forEach(el => articles.push(el));
      } catch(e) {}
    });
    articles = [...new Set(articles)];
    
    const uiWords = ['Follow', 'Like', 'Comment', 'Share', 'See more', 'See earlier', 'Learn more', 'Send', 'Save', 'Report'];
    
    for (const article of articles) {
      try {
        const post = { postText: '', postedAt: '', url: '' };
        
        const textContent = article.innerText;
        const lines = textContent.split('\n').filter(l => l.trim());
        
        let contentLines = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          if (trimmed.match(/^\d+[smhdw]/i) || trimmed.match(/^[A-Z][a-z]+\s\d+/)) {
            if (!post.postedAt) post.postedAt = trimmed;
            continue;
          }
          
          const isUiWord = uiWords.some(w => trimmed === w || trimmed.startsWith(w + ' '));
          if (isUiWord || trimmed.includes(' · ')) continue;
          
          if (trimmed.length > 25 && !trimmed.match(/^\d+$/)) {
            contentLines.push(trimmed);
          }
        }
        
        post.postText = contentLines.join(' ').slice(0, 600);
        
        if (post.postText.length > 0 && post.postText.length < 65 && post.postText === post.postText.toUpperCase()) {
          continue;
        }
        
        const linkSelectors = ['a[href*="/posts/"]', 'a[href*="/story"]', 'a[href*="/photo/"]', 'a[href*="/video/"]'];
        let link = null;
        for (const sel of linkSelectors) {
          link = article.querySelector(sel);
          if (link && link.href && link.href.includes('facebook.com')) break;
        }
        
        if (link) post.url = link.href;
        
        const timeEl = article.querySelector('time');
        if (timeEl && timeEl.getAttribute('datetime')) {
          post.postedAt = timeEl.getAttribute('datetime');
        }
        
        if (post.postText.length > 10 || post.url) {
          results.push(post);
        }
      } catch (e) {}
    }
    
    return results;
  });

  return postsData;
}

module.exports = { scrapeFacebook, PLATFORMS: PLATFORMS.FACEBOOK };