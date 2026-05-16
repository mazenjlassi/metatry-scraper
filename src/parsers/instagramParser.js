function parseEngagementNumber(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[,\s]/g, '').toLowerCase();
  if (cleaned.includes('k')) {
    return Math.round(parseFloat(cleaned) * 1000);
  }
  if (cleaned.includes('m')) {
    return Math.round(parseFloat(cleaned) * 1000000);
  }
  const num = parseInt(cleaned.replace(/\D/g, ''));
  return isNaN(num) ? 0 : num;
}

function parseRelativeTime(text) {
  if (!text) return new Date().toISOString();
  const now = new Date();
  const lower = text.toLowerCase();
  
  if (lower.includes('s') && !lower.includes('seconds')) {
    const sec = parseInt(lower.replace(/\D/g, '')) || 1;
    return new Date(now - sec * 1000).toISOString();
  }
  if (lower.includes('m') && !lower.includes('more')) {
    const min = parseInt(lower.replace(/\D/g, '')) || 1;
    return new Date(now - min * 60000).toISOString();
  }
  if (lower.includes('h')) {
    const hr = parseInt(lower.replace(/\D/g, '')) || 1;
    return new Date(now - hr * 3600000).toISOString();
  }
  if (lower.includes('d')) {
    const day = parseInt(lower.replace(/\D/g, '')) || 1;
    return new Date(now - day * 86400000).toISOString();
  }
  if (lower.includes('w')) {
    const wk = parseInt(lower.replace(/\D/g, '')) || 1;
    return new Date(now - wk * 604800000).toISOString();
  }
  
  return new Date().toISOString();
}

function extractHashtags(text) {
  if (!text) return [];
  const hashtags = text.match(/#\w+/g);
  return hashtags ? hashtags.map(h => h.slice(1).toLowerCase()) : [];
}

function identifyMediaType(page) {
  return page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) return 'video';
    const images = document.querySelectorAll('img');
    if (images.length > 1) return 'carousel';
    if (images.length === 1) return 'image';
    return 'unknown';
  });
}

module.exports = {
  parseEngagementNumber,
  parseRelativeTime,
  extractHashtags,
  identifyMediaType
};