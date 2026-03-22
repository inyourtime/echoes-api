import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const oauthProviderEnum = pgEnum('oauth_provider', ['google', 'github'])

// ─── users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerifiedAt: timestamp('email_verified_at'),
    passwordHash: varchar('password_hash', { length: 255 }),
    name: varchar('name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),
    // bump เพื่อ invalidate refresh token ทั้งหมดของ user ทันที
    // (logout-all, password change, account compromise)
    tokenVersion: integer('token_version').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
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
    tokenExpiresAt: timestamp('token_expires_at'),
    scope: varchar('scope', { length: 512 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
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
    expiresAt: timestamp('expires_at').notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
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
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('verification_tokens_hash_idx').on(t.tokenHash),
    index('verification_tokens_user_idx').on(t.userId),
    index('verification_tokens_expires_idx').on(t.expiresAt),
  ],
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  oauthAccounts: many(oauthAccounts),
  refreshTokens: many(refreshTokens),
  verificationTokens: many(verificationTokens),
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

// ─── Types ────────────────────────────────────────────────────────────────────

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
