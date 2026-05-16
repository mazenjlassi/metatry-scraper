const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');
const { parseEngagementNumber, parseRelativeTime, extractHashtags, extractMentions, extractTimestamp } = require('../parsers/baseParser');

async function scrapeLinkedIn(page, companyName) {
  try {
    console.log(`[LinkedIn] Scraping posts...`);
    
    await randomDelay(2000, 4000);

    const posts = await extractLinkedInPosts(page);
    console.log(`[LinkedIn] Collected ${posts.length} posts`);

    return posts;
  } catch (error) {
    console.log(`[LinkedIn] Scraping failed: ${error.message}`);
    return [];
  }
}

async function extractLinkedInPosts(page) {
  await randomDelay(3000, 5000);

  const postsData = await page.evaluate(() => {
    const results = [];
    const articles = document.querySelectorAll('.feed-shared-update-v2, .feed-item, [data-id]');
    
    for (const article of articles) {
      try {
        const post = {
          postText: '',
          likes: '0',
          comments: '0',
          shares: '0',
          postedAt: '',
          url: '',
          mediaType: 'text'
        };
        
        const textContent = article.innerText;
        
        const contentDiv = article.querySelector('.feed-shared-text, .update-text, [data-raw-text]');
        if (contentDiv) {
          post.postText = contentDiv.innerText || contentDiv.textContent || '';
        } else {
          const paragraphs = article.querySelectorAll('p');
          const textParts = [];
          paragraphs.forEach(p => {
            const text = p.innerText.trim();
            if (text.length > 20 && !text.includes('See more')) {
              textParts.push(text);
            }
          });
          post.postText = textParts.join(' ').slice(0, 500);
        }
        
        const spans = article.querySelectorAll('span');
        for (const span of spans) {
          const text = span.innerText?.trim() || '';
          
          if (text.match(/\d+[\d,.]*\s*(like|reaction)/i)) {
            const match = text.match(/([\d,.]+[KMB]?)/i);
            if (match) post.likes = match[1];
          }
          
          if (text.match(/\d+\s*comment/i)) {
            const match = text.match(/([\d,.]+)/i);
            if (match) post.comments = match[1];
          }
          
          if (text.match(/\d+\s*repost/i) || text.match(/\d+\s*share/i)) {
            const match = text.match(/([\d,.]+)/i);
            if (match) post.shares = match[1];
          }
        }
        
        const timeEl = article.querySelector('time');
        if (timeEl) {
          const datetime = timeEl.getAttribute('datetime');
          if (datetime) post.postedAt = datetime;
        } else {
          const timeSpan = article.querySelector('.feed-shared-actor__sub-description, .feed-shared-meta__info');
          if (timeSpan) {
            const timeText = timeSpan.innerText;
            if (timeText.match(/\d+[smhdw]/i)) {
              post.postedAt = timeText;
            }
          }
        }
        
        const link = article.querySelector('a[href*="/feed/"], a[href*="/posts/"]');
        if (link) post.url = link.href;
        
        const video = article.querySelector('video');
        if (video) post.mediaType = 'video';
        
        const image = article.querySelector('.feed-shared-image__image, img[src*="static.licdn.com"]');
        if (image) post.mediaType = image ? 'image' : 'text';
        
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
      mediaType: postData.mediaType,
      hashtags,
      mentions,
      url: postData.url
    }));
  }

  return posts;
}

module.exports = { scrapeLinkedIn, PLATFORMS: PLATFORMS.LINKEDIN };