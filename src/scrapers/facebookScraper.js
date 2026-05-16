const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');
const { parseEngagementNumber, parseRelativeTime, extractHashtags, extractMentions, identifyMediaType, extractTimestamp } = require('../parsers/baseParser');

async function scrapeFacebook(page, companyName) {
  console.log(`[Facebook] Scraping ${companyName}...`);
  
  await page.goto(settings.targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await randomDelay(2000, 4000);

  const posts = await extractFacebookPosts(page);
  console.log(`[Facebook] Collected ${posts.length} posts`);

  return posts;
}

async function extractFacebookPosts(page) {
  await randomDelay(3000, 5000);

  const postsData = await page.evaluate(() => {
    const results = [];
    const articles = document.querySelectorAll('article, [role="article"], div[aria-label*="Post"]');
    
    for (const article of articles) {
      try {
        const post = {
          postText: '',
          likes: '0',
          comments: '0',
          shares: '0',
          postedAt: '',
          url: ''
        };
        
        const textContent = article.innerText;
        const lines = textContent.split('\n').filter(l => l.trim());
        
        let foundContent = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.match(/^\d+\s*(like|reaction)/i)) {
            const match = line.match(/([\d,.]+[KMB]?)/i);
            if (match) post.likes = match[1];
            continue;
          }
          
          if (line.match(/^\d+\s*comment/i)) {
            const match = line.match(/([\d,.]+)/i);
            if (match) post.comments = match[1];
            continue;
          }
          
          if (line.match(/^\d+\s*share/i)) {
            const match = line.match(/([\d,.]+)/i);
            if (match) post.shares = match[1];
            continue;
          }
          
          if (line.match(/^\d+[smhdw]/i) || line.match(/^[A-Z][a-z]+\s\d+/)) {
            post.postedAt = line;
            continue;
          }
          
          if (line.length > 20 && !line.includes('Follow') && 
              !line.includes('Like') && !line.includes('Comment') &&
              !line.includes('Share') && !line.includes('See more')) {
            if (!foundContent) {
              post.postText = line;
              foundContent = true;
            }
          }
        }
        
        const link = article.querySelector('a[href*="/posts/"], a[href*="/story"]');
        if (link) post.url = link.href;
        
        const timeEl = article.querySelector('time');
        if (timeEl) {
          const datetime = timeEl.getAttribute('datetime');
          if (datetime) post.postedAt = datetime;
        }
        
        if (post.postText.length > 10) {
          results.push(post);
        }
      } catch (e) {
        continue;
      }
    }
    
    return results.slice(0, 20);
  });

  const posts = [];
  for (const postData of postsData.slice(0, settings.postLimit)) {
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
      likes: parseEngagementNumber(postData.likes),
      comments: parseEngagementNumber(postData.comments),
      shares: parseEngagementNumber(postData.shares),
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