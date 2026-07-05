ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "source_type" text DEFAULT 'image' NOT NULL;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "display_storage_key" text;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "display_mime_type" text;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "display_file_size" integer;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "display_width" integer;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "display_height" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photo_assets" (
  "id" serial PRIMARY KEY NOT NULL,
  "photo_id" text NOT NULL REFERENCES "photos"("id") ON DELETE cascade,
  "kind" text DEFAULT 'uploaded-render' NOT NULL,
  "storage_key" text NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size" integer NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
