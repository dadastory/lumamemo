CREATE TABLE IF NOT EXISTS "user_invites" (
  "id" serial PRIMARY KEY,
  "email" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "role" text DEFAULT 'user' NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "accepted_at" timestamptz,
  "accepted_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "revoked_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_invites_email" ON "user_invites" ("email");
