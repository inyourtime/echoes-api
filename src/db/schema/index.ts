import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const oauthProviderEnum = pgEnum('oauth_provider', ['google', 'github'])
export const trackSourceEnum = pgEnum('track_source', ['spotify', 'manual'])

// ─── users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerifiedAt: timestamp('email_verified_at', { mode: 'string' }),
    passwordHash: varchar('password_hash', { length: 255 }),
    name: varchar('name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),
    // bump เพื่อ invalidate refresh token ทั้งหมดของ user ทันที
    // (logout-all, password change, account compromise)
    tokenVersion: integer('token_version').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
)

// ─── oauth_accounts ───────────────────────────────────────────────────────────

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: oauthProviderEnum('provider').notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { mode: 'string' }),
    scope: varchar('scope', { length: 512 }),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    uniqueIndex('oauth_user_provider_idx').on(t.userId, t.provider),
    uniqueIndex('oauth_provider_account_idx').on(t.provider, t.providerAccountId),
  ],
)

// ─── refresh_tokens ───────────────────────────────────────────────────────────
// Strategy: 1 row ต่อ device (family) + counter-based reuse detection
//
//   rotationCounter คือ "กี่ครั้งที่ rotate แล้ว" สำหรับ family นี้
//   ทุก rotate: DB.rotationCounter++ และ JWT ใหม่จะ embed ctr = rotationCounter ใหม่
//
//   Reuse detection:
//     JWT.ctr < DB.rotationCounter  → token เก่าถูกนำมาใช้ซ้ำ (stolen)
//     JWT.ctr = DB.rotationCounter  → valid, ดำเนินการต่อ
//     JWT.ctr > DB.rotationCounter  → ไม่ควรเกิด (token จากอนาคต)
//
//   ข้อดีเหนือ tokenHash:
//     - ไม่ต้องคำนวณ SHA-256 ทุก request
//     - ลด index 1 ตัว (ไม่ต้องมี unique index บน hash)
//     - เห็นได้ชัดว่า rotate ไปแล้วกี่รอบ (ใช้ monitor ได้)

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // family = device identifier (UUID คงที่ตลอดอายุ device)
    family: uuid('family').notNull().unique(),
    // token hash for reuse detection
    tokenHash: text('token_hash').notNull(),
    // snapshot tokenVersion ตอนออก token
    // ถ้า users.tokenVersion > นี้ → token ถูก invalidate แล้ว
    tokenVersion: integer('token_version').notNull().default(0),
    // sliding expiry: เลื่อนออกทุก rotate → user ที่ active ไม่โดน logout
    expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    lastUsedAt: timestamp('last_used_at', { mode: 'string' }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_family_idx').on(t.family),
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_expires_idx').on(t.expiresAt),
  ],
)

// ─── user_verification_tokens ────────────────────────────────────────────────
// ใช้สำหรับ email verification / password reset / etc
// token ควรเก็บเป็น hash (SHA-256) เพื่อป้องกัน DB leak

export const verificationTokenTypeEnum = pgEnum('verification_token_type', [
  'email_verification',
  'password_reset',
])

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: verificationTokenTypeEnum('type').notNull(),
    // store SHA256(token)
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
    usedAt: timestamp('used_at', { mode: 'string' }),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('verification_tokens_hash_idx').on(t.tokenHash),
    index('verification_tokens_user_idx').on(t.userId),
    index('verification_tokens_expires_idx').on(t.expiresAt),
  ],
)

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 MUSIC TIMELINE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

// ─── tracks ───────────────────────────────────────────────────────────────────
// ข้อมูลกลางของเพลง ไม่ผูกกับ user ใดเลย
// รองรับทั้ง Spotify tracks และ manual tracks ที่ user กรอกเอง

export const tracks = pgTable(
  'tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // บอกว่าข้อมูลมาจากไหน → dedup logic ต่างกันตาม source
    source: trackSourceEnum('source').notNull().default('manual'),

    // Spotify tracks: spotifyTrackId เป็น natural key
    // Manual tracks: จะเป็น null
    spotifyTrackId: varchar('spotify_track_id', { length: 255 }),

    // Normalized fields สำหรับ dedup manual tracks
    // "The Weeknd", "the weeknd", "THE WEEKND" → "the weeknd"
    // Spotify tracks ไม่จำเป็นต้องใช้ fields นี้
    titleNormalized: varchar('title_normalized', { length: 500 }),
    artistNormalized: varchar('artist_normalized', { length: 500 }),

    // Display fields (ทั้งสอง source ใช้ร่วมกัน)
    title: varchar('title', { length: 500 }).notNull(),
    artist: varchar('artist', { length: 500 }).notNull(),
    album: varchar('album', { length: 500 }),
    albumArtUrl: text('album_art_url'),
    genre: varchar('genre', { length: 255 }),
    durationMs: integer('duration_ms'),

    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    // Spotify tracks: dedup by spotifyTrackId (partial index — เฉพาะ row ที่ไม่ null)
    uniqueIndex('tracks_spotify_id_unique')
      .on(t.spotifyTrackId)
      .where(sql`spotify_track_id IS NOT NULL`),

    // Manual tracks: dedup by normalized title + artist
    uniqueIndex('tracks_manual_unique')
      .on(t.titleNormalized, t.artistNormalized)
      .where(sql`source = 'manual'`),

    // สำหรับ Stats query "top artists"
    index('tracks_artist_normalized_idx').on(t.artistNormalized),
  ],
)

// ─── user_tracks ──────────────────────────────────────────────────────────────
// Junction + บริบทส่วนตัวของแต่ละ user
// user คนเดียวบันทึกเพลงเดิมซ้ำได้ เพราะอาจมีความทรงจำหลายครั้ง

export const userTracks = pgTable(
  'user_tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      // CASCADE: ลบ user → ลบ timeline ทั้งหมดของ user นั้นตามไปด้วย
      .references(() => users.id, { onDelete: 'cascade' }),

    trackId: uuid('track_id')
      .notNull()
      // RESTRICT: ป้องกันลบ track ที่ยังมี user อ้างอิงอยู่
      // (ใน real app แทบไม่ลบ tracks เลย)
      .references(() => tracks.id, { onDelete: 'restrict' }),

    // ─── User context (ข้อมูลส่วนตัวของแต่ละ user) ───────────────────────────

    note: text('note'),

    // YouTube URL อยู่ที่นี่ ไม่ใช่ใน tracks
    // เพราะแต่ละ user อาจใช้ link คนละอัน หรือใส่เฉพาะบาง entry
    youtubeUrl: text('youtube_url'),

    // วันที่ user ระบุว่า "ฟังครั้งแรก" (ตั้งเองได้ ≠ createdAt)
    // เช่น บันทึกวันนี้ แต่ระบุว่าฟังตอนไปญี่ปุ่นปีที่แล้ว
    listenedAt: timestamp('listened_at', { mode: 'string' }).notNull().defaultNow(),

    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    // Timeline view: กรองตาม user เรียงตาม listenedAt (query หลัก)
    index('ut_user_listened_idx').on(t.userId, t.listenedAt),
  ],
)

// ─── tags ─────────────────────────────────────────────────────────────────────
// Tag เป็น per-user ให้แต่ละคนตั้งชื่อและสีได้อิสระ

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      // CASCADE: ลบ user → ลบ tag ทั้งหมดของ user นั้นตามไปด้วย
      .references(() => users.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 100 }).notNull(), // "sad", "study", "coding"
    color: varchar('color', { length: 7 }), // hex เช่น "#FF5733"

    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [
    // ชื่อ tag unique ต่อ user (คนละคนมี #study ได้)
    uniqueIndex('tags_user_name_unique').on(t.userId, t.name),
  ],
)

// ─── user_track_tags (junction) ───────────────────────────────────────────────
// Tags ชี้ไปที่ user_tracks (ไม่ใช่ tracks)
// เพราะ tag เป็น context ส่วนตัวของแต่ละ entry ไม่ใช่ของเพลง

export const userTrackTags = pgTable(
  'user_track_tags',
  {
    userTrackId: uuid('user_track_id')
      .notNull()
      // CASCADE: ลบ user_track entry → ลบ tags ที่ติดกับ entry นั้นตามไปด้วย
      .references(() => userTracks.id, { onDelete: 'cascade' }),

    tagId: uuid('tag_id')
      .notNull()
      // CASCADE: ลบ tag → ลบ tag ออกจากทุก entry ที่ติดไว้
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.userTrackId, t.tagId] }),
    // สำหรับ filter timeline by tag
    index('utt_tag_id_idx').on(t.tagId),
  ],
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  oauthAccounts: many(oauthAccounts),
  refreshTokens: many(refreshTokens),
  verificationTokens: many(verificationTokens),
  userTracks: many(userTracks),
  tags: many(tags),
}))

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, { fields: [oauthAccounts.userId], references: [users.id] }),
}))

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}))

export const verificationTokensRelations = relations(verificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [verificationTokens.userId],
    references: [users.id],
  }),
}))

export const tracksRelations = relations(tracks, ({ many }) => ({
  userTracks: many(userTracks),
}))

export const userTracksRelations = relations(userTracks, ({ one, many }) => ({
  user: one(users, {
    fields: [userTracks.userId],
    references: [users.id],
  }),
  track: one(tracks, {
    fields: [userTracks.trackId],
    references: [tracks.id],
  }),
  userTrackTags: many(userTrackTags),
}))

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, {
    fields: [tags.userId],
    references: [users.id],
  }),
  userTrackTags: many(userTrackTags),
}))

export const userTrackTagsRelations = relations(userTrackTags, ({ one }) => ({
  userTrack: one(userTracks, {
    fields: [userTrackTags.userTrackId],
    references: [userTracks.id],
  }),
  tag: one(tags, {
    fields: [userTrackTags.tagId],
    references: [tags.id],
  }),
}))

// ─── Types ────────────────────────────────────────────────────────────────────

// User and Auth Types
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type OauthAccount = typeof oauthAccounts.$inferSelect
export type NewOauthAccount = typeof oauthAccounts.$inferInsert
export type RefreshToken = typeof refreshTokens.$inferSelect
export type NewRefreshToken = typeof refreshTokens.$inferInsert
export type OauthProvider = (typeof oauthProviderEnum.enumValues)[number]
export type VerificationToken = typeof verificationTokens.$inferSelect
export type NewVerificationToken = typeof verificationTokens.$inferInsert
export type VerificationTokenType = (typeof verificationTokenTypeEnum.enumValues)[number]

// 🎵 Music Timeline Types
export type Track = typeof tracks.$inferSelect
export type NewTrack = typeof tracks.$inferInsert
export type UserTrack = typeof userTracks.$inferSelect
export type NewUserTrack = typeof userTracks.$inferInsert
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
export type UserTrackTag = typeof userTrackTags.$inferSelect
export type NewUserTrackTag = typeof userTrackTags.$inferInsert
