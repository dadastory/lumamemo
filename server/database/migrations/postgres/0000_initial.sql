CREATE TABLE "users" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "email" text NOT NULL UNIQUE,
  "password" text,
  "avatar" text,
  "created_at" timestamptz NOT NULL,
  "is_admin" integer DEFAULT 0 NOT NULL,
  "role" text DEFAULT 'user' NOT NULL,
  "disabled_at" timestamptz
);
--> statement-breakpoint
CREATE TABLE "photos" (
  "id" text PRIMARY KEY,
  "title" text,
  "description" text,
  "width" integer,
  "height" integer,
  "aspect_ratio" real,
  "date_taken" text,
  "storage_key" text,
  "thumbnail_key" text,
  "file_size" integer,
  "last_modified" text,
  "original_url" text,
  "thumbnail_url" text,
  "thumbnail_hash" text,
  "tags" jsonb,
  "exif" jsonb,
  "latitude" double precision,
  "longitude" double precision,
  "country" text,
  "city" text,
  "location_name" text,
  "is_live_photo" integer DEFAULT 0 NOT NULL,
  "live_photo_video_url" text,
  "live_photo_video_key" text,
  "owner_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "visibility" text DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "photos_id_unique" ON "photos" ("id");
--> statement-breakpoint
CREATE TABLE "pipeline_queue" (
  "id" serial PRIMARY KEY,
  "payload" jsonb DEFAULT '{"type":"photo","storageKey":""}'::jsonb NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "status_stage" text,
  "error_message" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz
);
--> statement-breakpoint
CREATE TABLE "photo_reactions" (
  "id" serial PRIMARY KEY,
  "photo_id" text NOT NULL REFERENCES "photos"("id") ON DELETE cascade,
  "reaction_type" text NOT NULL,
  "fingerprint" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "albums" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,
  "description" text,
  "cover_photo_id" text REFERENCES "photos"("id") ON DELETE set null,
  "owner_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "is_hidden" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "album_photos" (
  "id" serial PRIMARY KEY,
  "album_id" integer NOT NULL REFERENCES "albums"("id") ON DELETE cascade,
  "photo_id" text NOT NULL REFERENCES "photos"("id") ON DELETE cascade,
  "position" real DEFAULT 1000000 NOT NULL,
  "added_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
  "id" serial PRIMARY KEY,
  "namespace" text DEFAULT 'common' NOT NULL,
  "key" text NOT NULL,
  "type" text NOT NULL,
  "value" text,
  "default_value" text,
  "label" text,
  "description" text,
  "is_public" boolean DEFAULT false NOT NULL,
  "is_readonly" boolean DEFAULT false NOT NULL,
  "is_secret" boolean DEFAULT false NOT NULL,
  "enum" jsonb,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "updated_by" integer REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_namespace_key" ON "settings" ("namespace", "key");
--> statement-breakpoint
CREATE TABLE "settings_storage_providers" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "provider" text NOT NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
