const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');
const { extractHashtags, extractMentions } = require('../parsers/baseParser');
const { loginToInstagram } = require('../utils/browser');

async function dismissPopups(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await randomDelay(300, 700);
  }
}

async function scrapeInstagram(page, companyName, ctx, url) {
  try {
    console.log(`[Instagram] Scraping ${companyName}...`);
    console.log(`[Instagram] Target URL: ${url}`);

    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    await randomDelay(2000, 3000);
    await dismissPopups(page);

    const redirectedToLogin = await page.evaluate(() =>
      document.body.innerText.includes('Log into Instagram') &&
      document.body.innerText.includes('Password')
    );

    if (redirectedToLogin || page.url().includes('accounts/login')) {
      console.log('[Instagram] Login wall, attempting login...');
      const loggedIn = await loginToInstagram(page, ctx);
      if (!loggedIn) {
        console.log('[Instagram] Login failed');
        return [];
      }
      console.log('[Instagram] Login successful, navigating to profile...');
      await page.goto(url, { waitUntil: 'load', timeout: 20000 });
      await randomDelay(2000, 3000);
      await dismissPopups(page);
    }

    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 700));
      await randomDelay(400, 800);
    }

    await dismissPopups(page);

    const postUrls = await extractPostUrls(page);
    console.log(`[Instagram] Found ${postUrls.length} post URLs`);

    if (postUrls.length === 0) {
      console.log('[Instagram] No posts found - trying mobile viewport...');
      await page.setViewportSize({ width: 375, height: 812 });
      const mobileUrl = url.replace('www.instagram.com', 'm.instagram.com');
      await page.goto(mobileUrl, { waitUntil: 'load', timeout: 20000 });
      await randomDelay(2000, 3000);

      const mobilePosts = await extractMobilePosts(page);
      if (mobilePosts.length > 0) {
        console.log(`[Instagram] Collected ${mobilePosts.length} via mobile`);
        return mobilePosts;
      }

      return [];
    }

    const posts = [];
    const limit = Math.min(postUrls.length, settings.postLimit);
    const uniqueUrls = [...new Set(postUrls)].slice(0, limit);

    for (let i = 0; i < uniqueUrls.length; i++) {
      console.log(`[Instagram] Post ${i + 1}/${uniqueUrls.length}...`);
      try {
        const post = await scrapePostFromModal(page, uniqueUrls[i]);
        if (post) {
          posts.push(post);
          console.log(`[Instagram] Got: ${post.postText.slice(0, 40)}...`);
        }
      } catch (err) {
        console.log(`[Instagram] Post error: ${err.message}`);
        await page.keyboard.press('Escape').catch(() => {});
        await randomDelay(500, 1000);
      }
    }

    console.log(`[Instagram] Collected ${posts.length} posts`);
    return posts;
  } catch (error) {
    console.log(`[Instagram] Failed: ${error.message}`);
    return [];
  }
}

async function extractMobilePosts(page) {
  const posts = await page.evaluate(() => {
    const items = [];
    const articles = document.querySelectorAll('article');
    articles.forEach(article => {
      const textEl = article.querySelector('h1, h2, span');
      const text = textEl ? textEl.innerText.trim() : '';
      const link = article.querySelector('a[href*="/p/"]');
      const url = link ? 'https://www.instagram.com' + link.getAttribute('href') : '';
      if (text && url) {
        items.push({ text: text.slice(0, 500), url });
      }
    });
    return items;
  });

  return posts.map(p => createPostModel({
    postText: p.text,
    postedAt: new Date().toISOString(),
    hashtags: extractHashtags(p.text),
    mentions: extractMentions(p.text),
    url: p.url
  }));
}

async function extractPostUrls(page) {
  await randomDelay(1000, 1500);
  await dismissPopups(page);

  const postLinks = await page.evaluate(() => {
    const anchors = document.querySelectorAll('a[href*="/p/"]');
    return [...new Set(Array.from(anchors).map(a => a.href))];
  });

  console.log(`[Instagram] Found ${postLinks.length} post URLs`);
  return postLinks.slice(0, settings.postLimit + 5);
}

async function scrapePostFromModal(page, postUrl) {
  try {
    await page.goto(postUrl, { waitUntil: 'load', timeout: 15000 });
    await randomDelay(1500, 2500);
    await dismissPopups(page);

    const postData = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:description"]');
      let text = '';
      if (meta) {
        text = meta.getAttribute('content') || '';
        const colonIdx = text.indexOf(': ');
        if (colonIdx > 0) text = text.slice(colonIdx + 2);
      }
      if (!text || text.length < 10) {
        const spans = document.querySelectorAll('span');
        for (const s of spans) {
          const t = s.innerText.trim();
          if (t.length > 30 && !t.startsWith('http')) { text = t; break; }
        }
      }

      const timeEl = document.querySelector('time');
      const timeAttr = timeEl ? (timeEl.getAttribute('datetime') || '') : '';

      const altText = document.querySelector('img[alt*="Photo by"], img[alt*="Video by"], img[alt*="carousel"]');
      const captionText = altText ? altText.getAttribute('alt') || '' : '';
      if (!text && captionText.length > 20) text = captionText;

      return { text: text.slice(0, 600), time: timeAttr };
    });

    if (!postData || !postData.text || postData.text.length < 10) {
      console.log('[Instagram] Post data too short or null');
      return null;
    }

    return createPostModel({
      postText: postData.text,
      postedAt: postData.time || new Date().toISOString(),
      hashtags: extractHashtags(postData.text),
      mentions: extractMentions(postData.text),
      url: postUrl
    });
  } catch (err) {
    console.log(`[Instagram] Post scrape error: ${err.message}`);
    return null;
  }
}

module.exports = { scrapeInstagram, PLATFORMS: PLATFORMS.INSTAGRAM };