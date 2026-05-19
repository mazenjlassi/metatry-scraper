const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');

async function scrapeLinkedIn(page, companyName) {
  try {
    let targetUrl = settings.targetUrl;
    console.log(`[LinkedIn] Scraping ${companyName}...`);
    console.log(`[LinkedIn] Target URL: ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(4000, 6000);
    
    console.log('[LinkedIn] Scrolling to load posts...');
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await randomDelay(2000, 3000);
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
  await randomDelay(2000, 3000);

  const postsData = await page.evaluate(() => {
    const results = [];
    
    const articles = document.querySelectorAll('article');
    console.log('Found', articles.length, 'LinkedIn articles');
    
    const uiKeywords = ['Like', 'Comment', 'Share', 'Send', 'Repost', 'Save', 'Follow', 'Voir plus', 'J\'aime'];
    
    for (const article of articles) {
      try {
        const post = { postText: '', postedAt: '', url: '' };
        
        const textContent = article.innerText;
        const lines = textContent.split('\n').filter(l => l.trim());
        
        let contentLines = [];
        let foundTime = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.length < 5) continue;
          
          if (line.includes('abonnés') || line.includes('followers')) continue;
          
          if (line.match(/^\d+\s*(like|reaction|comment|view)/i)) continue;
          
          if (line.match(/^\d+\s*[hj]$/i) || line.match(/^\d+\s*(jour|heure|min)/i)) {
            if (!post.postedAt && !foundTime) {
              post.postedAt = line;
              foundTime = true;
            }
            continue;
          }
          
          const isUi = uiKeywords.some(k => 
            line === k || 
            line === k + ' ' || 
            line.startsWith(k + ' ') ||
            line.includes('commentaire') ||
            line.includes('partager')
          );
          if (isUi) continue;
          
          if (line.includes('Voir plus') || line.includes('…plus') || line.includes('…plus')) continue;
          
          if (line.length > 30 && !line.match(/^[A-Z][a-z]+\s+\d+\s+[a-z]+$/)) {
            contentLines.push(line);
          }
        }
        
        post.postText = contentLines.join(' ').slice(0, 600);
        
        if (post.postText.length > 0 && post.postText.length < 50 && post.postText === post.postText.toUpperCase()) {
          continue;
        }
        
        const linkEl = article.querySelector('a[href*="/feed/update/"], a[href*="/activities/"], a[href*="/company/"]');
        if (linkEl && linkEl.href && linkEl.href.includes('linkedin.com')) {
          let url = linkEl.href.split('?')[0];
          if (url.includes('/company/') && !url.includes('/feed/') && !url.includes('/activities/')) {
            url = window.location.href + '/posts';
          }
          post.url = url;
        }
        
        if (!post.url) {
          const currentUrl = window.location.href;
          post.url = currentUrl.includes('/company/') ? currentUrl : '';
        }
        
        if (post.postText.length > 20 || post.url) {
          results.push(post);
        }
      } catch (e) {}
    }
    
    return results;
  });

  return postsData;
}

module.exports = { scrapeLinkedIn, PLATFORMS: PLATFORMS.LINKEDIN };