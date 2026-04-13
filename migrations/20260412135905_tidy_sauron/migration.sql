CREATE TYPE "push_platform" AS ENUM('web');--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"platform" "push_platform" DEFAULT 'web'::"push_platform" NOT NULL,
	"token" text NOT NULL,
	"user_agent" text,
	"last_registered_at" timestamp(3) DEFAULT now() NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_token_unique" ON "push_tokens" ("token");--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "push_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "push_tokens_user_platform_idx" ON "push_tokens" ("user_id","platform");--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;