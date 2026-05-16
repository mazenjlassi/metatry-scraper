require('dotenv').config();

module.exports = {
  targetUrl: process.env.TARGET_URL || 'https://www.instagram.com/tcsglobal',
  postLimit: parseInt(process.env.POST_LIMIT) || 10,
  headless: process.env.HEADLESS === 'true',
  slowMo: parseInt(process.env.SLOWMO) || 100,
  viewport: { width: 1280, height: 720 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  company: 'IBM',
  platform: 'instagram'
};