# MetaTry Scraper - Agent Notes

## Project Overview

Multi-platform social media scraper (Instagram, Facebook, LinkedIn) for:
1. **Daily scraping** of company posts
2. **Pattern extraction** using Gemini AI
3. **Campaign integration** with Spring Boot backend for AI content generation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        METATRY PATTERN SYSTEM                                │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
  │   SCRAPER    │ OR   │  MANUAL      │ ───▶ │   Spring Boot    │
  │   (Node.js)  │      │  PASTE       │      │   Port: 8080     │
  │  Port: 3001  │      │  (Testing)   │      │                  │
  └──────────────┘      └──────────────┘      └──────────────┘
                                                         │
                                                         ▼
                                         ┌─────────────────────────┐
                                         │   New Database Tables   │
                                         │   - scraped_posts       │
                                         │   - content_patterns     │
                                         └─────────────────────────┘
                                                         │
                                          ┌───────────────┼───────────────┐
                                          ▼               ▼               ▼
                                  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                                  │  Pattern    │ │   Pattern   │ │   Campaign  │
                                  │  Extraction │ │   Storage   │ │   Matching  │
                                  │  (Gemini)   │ │             │ │  (Keyword)  │
                                  └─────────────┘ └─────────────┘ └─────────────┘
                                                         │
                                                         ▼
                                         ┌─────────────────────────┐
                                         │   Content Generation     │
                                         │   with Pattern Applied    │
                                         └─────────────────────────┘
```

## Current Status

### Scraper (Node.js) ✅

| Platform | Posts/Company | Login | Status |
|----------|--------------|-------|--------|
| **Instagram** | 7-15 | No | Working well |
| **Facebook** | 2-4 | Cookies | Limited by Facebook |
| **LinkedIn** | 0 | Required | Disabled |

### Spring Boot Backend ⚠️

| Component | Status | Notes |
|-----------|--------|-------|
| Campaign creation | ✅ Working | Existing |
| AI content generation | ✅ Working | Via Gemini |
| Scraped post storage | ❌ Not implemented | New feature |
| Pattern extraction | ❌ Not implemented | New feature |
| Pattern matching | ❌ Not implemented | New feature |

## New Feature: Pattern Analysis System

### Purpose

1. **Collect posts** from companies (scraped or manually pasted)
2. **Extract patterns** per topic/industry using Gemini AI
3. **Match patterns** to new campaigns for better content generation
4. **Apply patterns** to AI-generated content

### Pattern Data to Extract

| Field | Example |
|-------|---------|
| postFrequency | "3x/week", "daily", "weekly" |
| contentLength | "150-300 chars", "under 100" |
| mediaType | "80% images, 20% videos" |
| hashtagCount | "3-5 per post", "none" |
| timingPattern | "Tuesday/Thursday 9-11am" |
| tone | "Technical, educational", "Casual, friendly" |
| ctaStyle | "Links to articles", "Questions to engage" |

## New Database Tables

### scraped_posts
Stores posts for pattern analysis.

```sql
CREATE TABLE scraped_posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(255),
    platform VARCHAR(50),  -- FACEBOOK, INSTAGRAM
    post_text TEXT,
    post_url VARCHAR(500),
    posted_at DATETIME,
    scraped_at DATETIME,
    topic VARCHAR(255) DEFAULT 'General',
    used_for_pattern BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### content_patterns
Stores extracted patterns per topic.

```sql
CREATE TABLE content_patterns (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    topic VARCHAR(255) UNIQUE,
    platform VARCHAR(50),
    post_frequency VARCHAR(100),
    content_length VARCHAR(100),
    media_type VARCHAR(100),
    hashtag_count VARCHAR(100),
    timing_pattern VARCHAR(200),
    tone VARCHAR(255),
    cta_style VARCHAR(255),
    total_posts_analyzed INT,
    ai_analysis_raw TEXT,
    extracted_at DATETIME,
    last_updated_at DATETIME
);
```

## New API Endpoints

### Scraped Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scraped-posts/manual` | Add single post (manual paste) |
| POST | `/api/scraped-posts/bulk` | Add multiple posts (bulk paste) |
| GET | `/api/scraped-posts?topic={topic}` | Get posts by topic |
| GET | `/api/scraped-posts?company={name}` | Get posts by company |
| DELETE | `/api/scraped-posts/{id}` | Delete a post |

### Pattern Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/patterns/analyze` | Extract pattern from posts |
| GET | `/api/patterns` | Get all saved patterns |
| GET | `/api/patterns/{topic}` | Get pattern for specific topic |
| GET | `/api/patterns/match?topic={keyword}` | Find closest matching pattern |

## Manual Post Input (for testing)

### Single Post
```json
POST http://localhost:8080/api/scraped-posts/manual
{
  "companyName": "NVIDIA",
  "platform": "INSTAGRAM",
  "postText": "NVIDIA's latest GPU architecture delivers 3x faster AI training. #AI #GPU",
  "postUrl": "https://instagram.com/p/abc123",
  "postedAt": "2 days ago",
  "topic": "AI"
}
```

### Bulk Posts (for testing)
```json
POST http://localhost:8080/api/scraped-posts/bulk
{
  "postsData": "NVIDIA|FACEBOOK|text here|2 days ago\nGoogle|INSTAGRAM|text here|1 week ago",
  "defaultTopic": "AI"
}
```

### Analyze Pattern
```json
POST http://localhost:8080/api/patterns/analyze
{
  "topic": "AI",
  "platform": "INSTAGRAM",
  "minPostsRequired": 5
}
```

### Match Pattern for Campaign
```
GET http://localhost:8080/api/patterns/match?topic=Machine%20Learning
```

## Content Generation with Pattern

### Flow for New Campaign

```
1. User creates campaign: name="AI Campaign", topic="Artificial Intelligence"

2. System searches content_patterns:
   - Exact match: "Artificial Intelligence" → Use it
   - Partial match: "Intelligence" in topic → Use it
   - Keyword match: "AI" → Use it
   - No match → Generate without pattern constraints

3. If pattern found:
   - Pass pattern to content generation
   - Prompt includes pattern details:
     * Post frequency
     * Content length
     * Tone/style
     * CTA approach
```

## File Structure (Spring Boot)

```
metaTry/src/main/java/com/example/metatry/
├── Models/
│   ├── ScrapedPost.java      (NEW)
│   └── ContentPattern.java   (NEW)
├── Repositories/
│   ├── ScrapedPostRepository.java      (NEW)
│   └── ContentPatternRepository.java  (NEW)
├── DTOs/
│   ├── ManualPostInput.java           (NEW)
│   ├── BulkPostInput.java            (NEW)
│   ├── PatternAnalysisRequest.java   (NEW)
│   └── PatternResponse.java           (NEW)
├── Services/
│   ├── ScrapedPostService.java        (NEW)
│   └── PatternAnalysisService.java   (NEW)
└── Controllers/
    ├── ScrapedPostController.java     (NEW)
    └── PatternController.java         (NEW)
```

## Configuration

### Spring Boot
- Port: 8080
- Database: metatry (MySQL)
- `spring.jpa.hibernate.ddl-auto=update` (auto-creates tables)

### Scraper (Node.js)
- Port: 3001
- Cookies: sessions/facebook-cookies.json

## Testing

### Scraper
```bash
# Start scraper
cd C:\Users\DELL\Desktop\scrapping\metatry-scraper
node src/server.js

# Test single company
node test-3.js

# Test batch
node test-batch.js
```

### Spring Boot (with new endpoints)
```bash
# Start Spring Boot
cd C:\Users\DELL\Desktop\v2Dev\SymptomCheck\metaTry
mvn spring-boot:run

# Add manual post
curl -X POST http://localhost:8080/api/scraped-posts/manual \
  -H "Content-Type: application/json" \
  -d '{"companyName":"NVIDIA","platform":"INSTAGRAM","postText":"AI post text...","topic":"AI"}'

# Analyze pattern
curl -X POST http://localhost:8080/api/patterns/analyze \
  -H "Content-Type: application/json" \
  -d '{"topic":"AI","platform":"INSTAGRAM","minPostsRequired":5}'

# Find matching pattern
curl http://localhost:8080/api/patterns/match?topic=Machine%20Learning
```

## Known Issues

### Facebook Limitation
- Facebook page feeds show only 3-5 recent posts
- Cookies provide limited access
- Solutions: Bright Data ($), Graph API (needs page admin), or accept limitation

### Pattern Extraction
- Minimum 5 posts needed per topic/platform
- More posts = better pattern accuracy
- Manual paste for testing until auto-scraper integrated

## TODO

- [ ] Create ScrapedPost entity
- [ ] Create ContentPattern entity
- [ ] Create repositories
- [ ] Create DTOs
- [ ] Create ScrapedPostService
- [ ] Create PatternAnalysisService
- [ ] Create ScrapedPostController
- [ ] Create PatternController
- [ ] Integrate pattern with AiContentService
- [ ] Update PromptBuilderService to use patterns
- [ ] Test manual post input
- [ ] Test pattern extraction
- [ ] Test campaign pattern matching
- [ ] Add Angular UI for manual input (optional)

## Last Updated

2026-05-19

## TODO

- [ ] Create ScrapedPost entity
- [ ] Create ContentPattern entity
- [ ] Create repositories
- [ ] Create DTOs
- [ ] Create ScrapedPostService
- [ ] Create PatternAnalysisService
- [ ] Create ScrapedPostController
- [ ] Create PatternController
- [ ] Integrate pattern with AiContentService
- [ ] Update PromptBuilderService to use patterns
- [ ] Test manual post input
- [ ] Test pattern extraction
- [ ] Test campaign pattern matching
- [ ] Add Angular UI for manual input (optional)