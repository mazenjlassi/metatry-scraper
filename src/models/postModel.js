function createPostModel(data = {}) {
  return {
    platform: data.platform || '',
    company: data.company || '',
    postText: data.postText || '',
    likes: data.likes || 0,
    comments: data.comments || 0,
    shares: data.shares || 0,
    postedAt: data.postedAt || '',
    mediaType: data.mediaType || '',
    hashtags: data.hashtags || [],
    scrapedAt: data.scrapedAt || new Date().toISOString()
  };
}

module.exports = { createPostModel };