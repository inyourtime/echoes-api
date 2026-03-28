ALTER TABLE "user_tracks" ALTER COLUMN "listened_at" SET DATA TYPE timestamp (3);--> statement-breakpoint
ALTER TABLE "user_tracks" ALTER COLUMN "listened_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_tracks" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3);--> statement-breakpoint
ALTER TABLE "user_tracks" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_tracks" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3);--> statement-breakpoint
ALTER TABLE "user_tracks" ALTER COLUMN "updated_at" SET DEFAULT now();