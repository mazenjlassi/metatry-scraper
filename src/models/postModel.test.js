const {
    createPostModel,
    createResultObject,
    createResponse,
    PLATFORMS
} = require('./postModel');

describe('createPostModel', () => {
    test('returns defaults for empty input', () => {
        const post = createPostModel({});
        expect(post.postText).toBe('');
        expect(post.postedAt).toBe('');
        expect(post.mediaType).toBe('unknown');
        expect(post.hashtags).toEqual([]);
        expect(post.mentions).toEqual([]);
        expect(post.url).toBe('');
    });

    test('merges provided data', () => {
        const post = createPostModel({
            postText: 'Hello world',
            url: 'https://ig.com/p/1'
        });
        expect(post.postText).toBe('Hello world');
        expect(post.url).toBe('https://ig.com/p/1');
        expect(post.postedAt).toBe('');
    });

    test('passes hashtags and mentions', () => {
        const post = createPostModel({
            hashtags: ['ai', 'tech'],
            mentions: ['user1']
        });
        expect(post.hashtags).toEqual(['ai', 'tech']);
        expect(post.mentions).toEqual(['user1']);
    });
});

describe('createResultObject', () => {
    test('wraps posts with platform metadata', () => {
        const posts = [{ postText: 'test' }];
        const result = createResultObject('instagram', posts);
        expect(result.platform).toBe('instagram');
        expect(result.posts).toEqual(posts);
        expect(result.scrapedAt).toBeDefined();
        expect(typeof result.scrapedAt).toBe('string');
    });
});

describe('createResponse', () => {
    test('wraps results in full response', () => {
        const results = [{ platform: 'instagram', posts: [] }];
        const response = createResponse('NVIDIA', results);
        expect(response.companyName).toBe('NVIDIA');
        expect(response.results).toEqual(results);
        expect(response.scrapedAt).toBeDefined();
    });
});

describe('PLATFORMS', () => {
    test('defines all platforms', () => {
        expect(PLATFORMS.INSTAGRAM).toBe('instagram');
        expect(PLATFORMS.FACEBOOK).toBe('facebook');
        expect(PLATFORMS.LINKEDIN).toBe('linkedin');
    });
});
