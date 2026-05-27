const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');
const { extractHashtags, extractMentions } = require('../parsers/baseParser');

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
      console.log('[Instagram] Login wall - profile not publicly visible');
      return [];
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

  const debug = await page.evaluate(() => {
    const anchors = document.querySelectorAll('a[href*="/p/"]');
    const articles = document.querySelectorAll('article');
    const hiddenLinks = document.querySelectorAll('a[href*="/p/"]');
    const overlay = document.querySelector('div[role="presentation"]');
    return {
      postLinks: Array.from(anchors).map(a => a.href),
      totalLinks: document.querySelectorAll('a[href]').length,
      title: document.title,
      articleCount: articles.length,
      hasOverlay: !!overlay,
      overlayHTML: overlay ? overlay.innerHTML.slice(0, 200) : '',
      bodyPreview: document.body.innerText.slice(0, 400)
    };
  });

  console.log('[Instagram] Debug - title:', debug.title);
  console.log('[Instagram] Debug - total links:', debug.totalLinks);
  console.log('[Instagram] Debug - articles:', debug.articleCount);
  console.log('[Instagram] Debug - overlay:', debug.hasOverlay);
  console.log('[Instagram] Debug - post links:', debug.postLinks.length);
  console.log('[Instagram] Debug - body:', debug.bodyPreview);

  return [...new Set(debug.postLinks)].slice(0, settings.postLimit + 5);
}

async function scrapePostFromModal(page, postUrl) {
  try {
    await page.goto(postUrl, { waitUntil: 'load', timeout: 15000 });
    await randomDelay(1500, 2500);
    await dismissPopups(page);

    const debug = await page.evaluate(() => ({
      articleCount: document.querySelectorAll('article').length,
      bodyPreview: document.body.innerText.slice(0, 500),
      title: document.title,
      url: location.href
    }));

    console.log('[Instagram] Post debug:', JSON.stringify(debug));

    const postData = await page.evaluate(() => {
      const article = document.querySelector('article');
      if (!article) return null;

      const spans = article.querySelectorAll('span');
      let text = '';
      for (const s of spans) {
        const t = s.innerText.trim();
        if (t.length > 20) { text = t; break; }
      }

      const timeEl = article.querySelector('time');
      const time = timeEl ? (timeEl.getAttribute('datetime') || '') : '';
      return { text: text.slice(0, 500), time };
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