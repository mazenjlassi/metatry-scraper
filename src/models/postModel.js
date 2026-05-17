const PLATFORMS = {
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
  LINKEDIN: 'linkedin'
};

function createPostModel(data = {}) {
  return {
    postText: data.postText || '',
    postedAt: data.postedAt || '',
    mediaType: data.mediaType || 'unknown',
    hashtags: data.hashtags || [],
    mentions: data.mentions || [],
    url: data.url || ''
  };
}

function createResultObject(platform, posts) {
  return {
    platform,
    posts,
    scrapedAt: new Date().toISOString()
  };
}

function createResponse(companyName, results) {
  return {
    companyName,
    scrapedAt: new Date().toISOString(),
    results
  };
}

module.exports = {
  PLATFORMS,
  createPostModel,
  createResultObject,
  createResponse
};