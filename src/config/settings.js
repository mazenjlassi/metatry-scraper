require('dotenv').config();

module.exports = {
  targetUrl: process.env.TARGET_URL || 'https://www.instagram.com/ibm',
  postLimit: 5,
  headless: process.env.HEADLESS === 'true',
  slowMo: parseInt(process.env.SLOWMO) || 100,
  viewport: { width: 1280, height: 720 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  serverPort: parseInt(process.env.PORT) || 3000,
  brightDataProxy: process.env.BRIGHTDATA_PROXY || null
};