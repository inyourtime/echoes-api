# Music Life Timeline - Implementation Roadmap

A phased implementation plan covering all 7 recommended features from FEATURE.md, prioritized by user value and technical feasibility.

---

## Phase 1: Foundation (Week 1-2)
*Core stats and search capabilities using existing data*

### 1.1 Stats Dashboard API
**Priority:** High | **Complexity:** Low-Medium

New endpoints for user insights:
- `GET /stats/top-artists` - Top N artists by save count
- `GET /stats/monthly-activity` - Track count per month (last 12 months)
- `GET /stats/tag-distribution` - Tag breakdown with percentages
- `GET /stats/overview` - Combined stats response

**Key Implementation Points:**
- Leverage existing indexes (`tracks_artist_normalized_idx`, `ut_user_listened_idx`)
- Cache expensive aggregations (Redis or materialized view)
- Consider date range filters for all endpoints

### 1.2 Advanced Search & Filter
**Priority:** High | **Complexity:** Medium

Extend `GET /user-track` with query capabilities:
- Full-text search via existing `tsvector` column
- Filter by: `dateFrom`, `dateTo`, `tagIds`, `artist`
- Combined filters with AND logic

**Schema Changes:** None (tsvector ready)

---

## Phase 2: Engagement (Week 3-4)
*Features that drive daily active usage*

### 2.1 "On This Day" API
**Priority:** High | **Complexity:** Low

- `GET /memories/on-this-day` - Entries from same month/day in previous years
- `GET /memories/this-week` - Weekly reminiscence view
- Optional: Email/push notification trigger endpoint

### 2.2 Re-listen Reminder System
**Priority:** Medium | **Complexity:** Medium

**Schema Addition:**
```sql
ALTER TABLE user_tracks ADD COLUMN last_reminded_at timestamp;
```

- `GET /reminders/suggestions` - Tracks not listened in X days (configurable)
- `POST /reminders/:id/snooze` - Snooze reminder
- Background job for notification scheduling (optional Phase 3)

---

## Phase 3: Organization (Week 5-6)
*User content management features*

### 3.1 Collections (User Playlists)
**Priority:** Medium | **Complexity:** Medium

**New Tables:**
- `collections` (id, userId, name, description, color, createdAt)
- `collection_items` (collectionId, userTrackId, addedAt, order)

**Endpoints:**
- `GET|POST|PATCH|DELETE /collections`
- `POST /collections/:id/items` - Add track to collection
- `DELETE /collections/:id/items/:userTrackId`

### 3.2 Bulk Import
**Priority:** Low-Medium | **Complexity:** Medium-High

**Supported Sources:**
- Spotify playlist URL → fetch tracks → create entries
- YouTube playlist URL → similar flow
- CSV upload (custom format)

**Endpoints:**
- `POST /import/spotify` - Accept playlist URL, async processing
- `POST /import/youtube` - Accept playlist URL
- `POST /import/csv` - File upload

**Considerations:**
- Rate limiting for external API calls
- Async job queue for large imports
- Duplicate detection during import

---

## Phase 4: Distribution (Week 7-8)
*Sharing and export capabilities*

### 4.1 Export Functionality
**Priority:** Medium | **Complexity:** Medium

- `GET /export/timeline` - Generate export (JSON/CSV/PDF)
- `GET /export/timeline/:id/download` - Download generated file
- Background job for PDF generation

### 4.2 Shareable Links
**Priority:** Medium | **Complexity:** Medium

**Schema Addition:**
```sql
CREATE TABLE shared_entries (
  id uuid primary key,
  user_track_id uuid references user_tracks,
  share_token varchar unique, -- random token for URL
  expires_at timestamp nullable,
  view_count integer default 0,
  created_at timestamp
);
```

- `POST /user-track/:id/share` - Create shareable link
- `GET /s/:token` - Public view endpoint (no auth required)
- `DELETE /user-track/:id/share` - Revoke sharing

---

## Technical Considerations

### Database Migrations
All schema changes should be in `/src/db/migrations/` using Drizzle.

### API Consistency
- Follow existing TypeBox schema patterns
- Maintain auth middleware usage
- Consistent error response format

### Performance
- Stats queries should use materialized views or caching
- Search pagination with cursor or offset
- Background jobs for heavy operations (imports, exports)

### Testing Strategy
- Unit tests for repository layer additions
- Integration tests for new endpoints
- Test data factories for new tables

---

## Quick Win Priority

If limited time, implement in this order:
1. **Stats Dashboard** - Immediate user value, low effort
2. **Advanced Search** - Schema ready, improves UX
3. **On This Day** - Simple query, high engagement potential
4. **Shareable Links** - Viral growth feature
5. **Collections** - Organization improvement
6. **Re-listen Reminder** - Engagement feature
7. **Bulk Import** - Complex but valuable for onboarding
