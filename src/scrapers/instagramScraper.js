const settings = require('../config/settings');
const { randomDelay } = require('../utils/delays');
const { createPostModel, PLATFORMS } = require('../models/postModel');
const { extractHashtags, extractMentions } = require('../parsers/baseParser');
const { loginToInstagram } = require('../utils/browser');

async function closeLoginPopup(page) {
  try {
    await page.evaluate(() => {
      const closeButtons = document.querySelectorAll('button[aria-label="Close"], div[role="dialog"] button');
      closeButtons.forEach(btn => btn.click());
      const dialog = document.querySelector('div[role="dialog"]');
      if (dialog) dialog.style.display = 'none';
      const overlay = document.querySelector('div[role="presentation"]');
      if (overlay) overlay.remove();
    });
    await page.keyboard.press('Escape');
    await randomDelay(500, 1000);
  } catch (_) {}
}

async function dismissLoginWall(page) {
  const hasWall = await page.evaluate(() =>
    document.body.innerText.includes('Log into Instagram') &&
    document.body.innerText.includes('Password')
  );
  if (!hasWall) return false;

  console.log('[Instagram] Login wall detected, trying to dismiss...');
  await page.keyboard.press('Escape');
  await randomDelay(1000, 1500);

  const stillHasWall = await page.evaluate(() =>
    document.body.innerText.includes('Log into Instagram') &&
    document.body.innerText.includes('Password')
  );
  return !stillHasWall;
}

async function scrapeInstagram(page, companyName, ctx, url) {
  try {
    console.log(`[Instagram] Scraping ${companyName}...`);
    console.log(`[Instagram] Target URL: ${url}`);

    const loggedIn = await loginToInstagram(page, ctx);
    if (!loggedIn) {
      console.log('[Instagram] Cannot access profile without login');
      return [];
    }

    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    await randomDelay(2000, 3000);
    await closeLoginPopup(page);

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await randomDelay(500, 1000);
    }

    const postUrls = await extractPostUrls(page);
    console.log(`[Instagram] Found ${postUrls.length} post URLs`);

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

async function extractPostUrls(page) {
  await randomDelay(1000, 1500);
  await closeLoginPopup(page);

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
  const href = new URL(postUrl).pathname;

  for (let j = 0; j < 3; j++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }

  const articleCountBefore = await page.evaluate(() =>
    document.querySelectorAll('article').length
  );

  const clicked = await page.evaluate((path) => {
    const link = document.querySelector(`a[href="${path}"]`);
    if (link) { link.scrollIntoView({ block: 'center' }); link.click(); return true; }
    return false;
  }, href);

  if (!clicked) {
    console.log(`[Instagram] Could not click: ${href}`);
    return null;
  }

  await page.waitForTimeout(1500);
  try {
    await page.waitForFunction(
      (prevCount) => document.querySelectorAll('article').length !== prevCount,
      articleCountBefore,
      { timeout: 5000 }
    );
  } catch (_) {
    console.log(`[Instagram] Modal did not open: ${href}`);
    return null;
  }

  const caption = await page.evaluate(() => {
    const articles = document.querySelectorAll('article');
    const article = articles[articles.length - 1];
    if (!article) return { text: '', time: '' };

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

  if (!caption.text || caption.text.length < 10) return null;

  return createPostModel({
    postText: caption.text,
    postedAt: caption.time || new Date().toISOString(),
    hashtags: extractHashtags(caption.text),
    mentions: extractMentions(caption.text),
    url: postUrl
  });
}

module.exports = { scrapeInstagram, PLATFORMS: PLATFORMS.INSTAGRAM };