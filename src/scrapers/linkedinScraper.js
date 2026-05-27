const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');

async function scrapeLinkedIn(page, companyName, url) {
  try {
    const targetUrl = url;
    console.log(`[LinkedIn] Scraping ${companyName}...`);
    console.log(`[LinkedIn] Target URL: ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(3000, 4000);
    
    console.log('[LinkedIn] Scrolling to load posts...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await randomDelay(1500, 2000);
    }
    
    const posts = await extractLinkedInPosts(page);
    console.log(`[LinkedIn] Extracted: ${posts.length} posts`);
    
    return posts;
    
  } catch (error) {
    console.log(`[LinkedIn] Failed: ${error.message}`);
    return [];
  }
}

async function extractLinkedInPosts(page) {
  await randomDelay(1000, 1500);

  const postsData = await page.evaluate(() => {
    const results = [];
    const articles = document.querySelectorAll('article');
    
    const linkSelectors = 'a[href*="/feed/update/"], a[href*="/activities/"]';
    
    for (const article of articles) {
      try {
        const text = article.innerText;
        const lines = text.split('\n').filter(l => l.trim());
        
        let contentLines = [];
        let time = '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (!line) continue;
          if (line === 'OpenAI' || line === 'OpenAI reposted this') continue;
          if (line.includes('followers')) continue;
          if (line === 'Like' || line === 'Comment' || line === 'Share') continue;
          if (line.match(/^\d+\s*Comments?$/i) || line.match(/^\d+(,\d+)*$/)) continue;
          if (line.startsWith('http') || line.startsWith('https')) continue;
          
          const timeMatch = line.match(/^(\d+)(m|h|d|w|mo|y)\s*(Edited)?$/i);
          if (timeMatch) {
            if (!time) time = line;
            continue;
          }
          
          if (line.length > 20) {
            contentLines.push(line);
          }
        }
        
        const postText = contentLines.join(' ').slice(0, 600);
        if (!postText || postText.length < 20) continue;
        
        const linkEl = article.querySelector(linkSelectors);
        let postUrl = '';
        if (linkEl && linkEl.href) {
          postUrl = linkEl.href.split('?')[0];
        }
        
        results.push({
          postText,
          postedAt: time || '',
          url: postUrl || ''
        });
      } catch (e) {
        // skip malformed articles
      }
    }
    
    return results;
  });

  return postsData;
}

module.exports = { scrapeLinkedIn, PLATFORMS: PLATFORMS.LINKEDIN };
