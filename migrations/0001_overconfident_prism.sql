ALTER TABLE "refresh_tokens" ADD COLUMN "token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP COLUMN "rotation_counter";