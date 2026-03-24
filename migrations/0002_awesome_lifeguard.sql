CREATE TYPE "public"."track_source" AS ENUM('spotify', 'manual');--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "track_source" DEFAULT 'manual' NOT NULL,
	"spotify_track_id" varchar(255),
	"title_normalized" varchar(500),
	"artist_normalized" varchar(500),
	"title" varchar(500) NOT NULL,
	"artist" varchar(500) NOT NULL,
	"album" varchar(500),
	"album_art_url" text,
	"genre" varchar(255),
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_track_tags" (
	"user_track_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "user_track_tags_user_track_id_tag_id_pk" PRIMARY KEY("user_track_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "user_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"note" text,
	"youtube_url" text,
	"listened_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_track_tags" ADD CONSTRAINT "user_track_tags_user_track_id_user_tracks_id_fk" FOREIGN KEY ("user_track_id") REFERENCES "public"."user_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_track_tags" ADD CONSTRAINT "user_track_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tracks" ADD CONSTRAINT "user_tracks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tracks" ADD CONSTRAINT "user_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_unique" ON "tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_spotify_id_unique" ON "tracks" USING btree ("spotify_track_id") WHERE spotify_track_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_manual_unique" ON "tracks" USING btree ("title_normalized","artist_normalized") WHERE source = 'manual';--> statement-breakpoint
CREATE INDEX "tracks_artist_normalized_idx" ON "tracks" USING btree ("artist_normalized");--> statement-breakpoint
CREATE INDEX "utt_tag_id_idx" ON "user_track_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "ut_user_listened_idx" ON "user_tracks" USING btree ("user_id","listened_at");