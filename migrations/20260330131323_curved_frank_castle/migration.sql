CREATE TYPE "oauth_provider" AS ENUM('google', 'github');--> statement-breakpoint
CREATE TYPE "track_source" AS ENUM('spotify', 'apple-music', 'manual');--> statement-breakpoint
CREATE TYPE "verification_token_type" AS ENUM('email_verification', 'password_reset');--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp(3),
	"scope" varchar(512),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"family" uuid NOT NULL UNIQUE,
	"token_hash" text NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp(3) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"last_used_at" timestamp(3) DEFAULT now() NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7),
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source" "track_source" DEFAULT 'manual'::"track_source" NOT NULL,
	"external_id" varchar(255),
	"title_normalized" varchar(500) NOT NULL,
	"artist_normalized" varchar(500) NOT NULL,
	"title" varchar(500) NOT NULL,
	"artist" varchar(500) NOT NULL,
	"search" tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', "tracks"."title"), 'A') ||
      setweight(to_tsvector('simple', "tracks"."artist"), 'B')
    ) STORED,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_track_tags" (
	"user_track_id" uuid,
	"tag_id" uuid,
	CONSTRAINT "user_track_tags_pkey" PRIMARY KEY("user_track_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "user_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"note" text,
	"youtube_url" text,
	"spotify_url" text,
	"apple_music_url" text,
	"other_url" text,
	"listened_at" timestamp(3) DEFAULT now() NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(255) NOT NULL UNIQUE,
	"email_verified_at" timestamp(3),
	"password_hash" varchar(255),
	"name" varchar(255),
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"type" "verification_token_type" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp(3) NOT NULL,
	"used_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_user_provider_idx" ON "oauth_accounts" ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_provider_account_idx" ON "oauth_accounts" ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" ("family");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_idx" ON "refresh_tokens" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_unique" ON "tags" ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_unique" ON "tracks" ("title_normalized","artist_normalized");--> statement-breakpoint
CREATE INDEX "tracks_artist_normalized_idx" ON "tracks" ("artist_normalized");--> statement-breakpoint
CREATE INDEX "tracks_search_idx" ON "tracks" USING gin ("search");--> statement-breakpoint
CREATE INDEX "utt_tag_id_idx" ON "user_track_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "ut_user_listened_idx" ON "user_tracks" ("user_id","listened_at");--> statement-breakpoint
CREATE INDEX "ut_user_track_idx" ON "user_tracks" ("user_id","track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_tokens_hash_idx" ON "verification_tokens" ("token_hash");--> statement-breakpoint
CREATE INDEX "verification_tokens_user_idx" ON "verification_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens" ("expires_at");--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_track_tags" ADD CONSTRAINT "user_track_tags_user_track_id_user_tracks_id_fkey" FOREIGN KEY ("user_track_id") REFERENCES "user_tracks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_track_tags" ADD CONSTRAINT "user_track_tags_tag_id_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_tracks" ADD CONSTRAINT "user_tracks_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_tracks" ADD CONSTRAINT "user_tracks_track_id_tracks_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;