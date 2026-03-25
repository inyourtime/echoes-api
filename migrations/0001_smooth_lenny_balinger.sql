DROP INDEX "tracks_external_id_unique";--> statement-breakpoint
DROP INDEX "tracks_manual_unique";--> statement-breakpoint
ALTER TABLE "tracks" ALTER COLUMN "title_normalized" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ALTER COLUMN "artist_normalized" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_unique" ON "tracks" USING btree ("title_normalized","artist_normalized");