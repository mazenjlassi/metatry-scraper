const {
    parseEngagementNumber,
    parseRelativeTime,
    extractHashtags,
    extractMentions,
} = require('./baseParser');

describe('parseEngagementNumber', () => {
    test('parses K suffix', () => {
        expect(parseEngagementNumber('1.2K')).toBe(1200);
        expect(parseEngagementNumber('500')).toBe(500);
        expect(parseEngagementNumber('10K')).toBe(10000);
    });

    test('parses M suffix', () => {
        expect(parseEngagementNumber('3M')).toBe(3000000);
        expect(parseEngagementNumber('1.5M')).toBe(1500000);
    });

    test('returns 0 for empty input', () => {
        expect(parseEngagementNumber('')).toBe(0);
        expect(parseEngagementNumber(null)).toBe(0);
        expect(parseEngagementNumber(undefined)).toBe(0);
    });

    test('handles commas in numbers', () => {
        expect(parseEngagementNumber('1,200')).toBe(1200);
        expect(parseEngagementNumber('1,000,000')).toBe(1000000);
    });

    test('handles lowercase k and m', () => {
        expect(parseEngagementNumber('2k')).toBe(2000);
        expect(parseEngagementNumber('5m')).toBe(5000000);
    });
});

describe('parseRelativeTime', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('parses seconds', () => {
        const result = parseRelativeTime('30s');
        expect(new Date(result).getTime()).toBe(new Date('2024-01-15T11:59:30Z').getTime());
    });

    test('parses minutes', () => {
        const result = parseRelativeTime('5m');
        expect(new Date(result).getTime()).toBe(new Date('2024-01-15T11:55:00Z').getTime());
    });

    test('parses hours', () => {
        const result = parseRelativeTime('2h');
        expect(new Date(result).getTime()).toBe(new Date('2024-01-15T10:00:00Z').getTime());
    });

    test('parses days', () => {
        const result = parseRelativeTime('3d');
        expect(new Date(result).getTime()).toBe(new Date('2024-01-12T12:00:00Z').getTime());
    });

    test('parses weeks', () => {
        const result = parseRelativeTime('1w');
        expect(new Date(result).getTime()).toBe(new Date('2024-01-08T12:00:00Z').getTime());
    });

    test('returns current time for empty input', () => {
        const result = parseRelativeTime('');
        expect(new Date(result).getTime()).toBe(new Date('2024-01-15T12:00:00Z').getTime());
    });
});

describe('extractHashtags', () => {
    test('extracts hashtags from text', () => {
        expect(extractHashtags('#AI #tech is great')).toEqual(['ai', 'tech']);
    });

    test('returns empty array for no hashtags', () => {
        expect(extractHashtags('no hashtags here')).toEqual([]);
    });

    test('returns empty for empty input', () => {
        expect(extractHashtags('')).toEqual([]);
        expect(extractHashtags(null)).toEqual([]);
    });

    test('handles unicode characters in hashtags', () => {
        expect(extractHashtags('#café #über')).toEqual(['café', 'über']);
    });
});

describe('extractMentions', () => {
    test('extracts mentions from text', () => {
        expect(extractMentions('@user and @admin here')).toEqual(['user', 'admin']);
    });

    test('returns empty array for no mentions', () => {
        expect(extractMentions('no mentions')).toEqual([]);
    });

    test('returns empty for empty input', () => {
        expect(extractMentions('')).toEqual([]);
        expect(extractMentions(null)).toEqual([]);
    });

    test('handles unicode in mentions', () => {
        expect(extractMentions('@françois')).toEqual(['françois']);
    });
});
