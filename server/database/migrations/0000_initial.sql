CREATE TABLE `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `password` text,
  `public_id` text,
  `display_name` text,
  `profile_title` text,
  `profile_slogan` text,
  `profile_bio` text,
  `homepage_visibility` text DEFAULT 'private' NOT NULL,
  `avatar` text,
  `created_at` integer NOT NULL,
  `is_admin` integer DEFAULT 0 NOT NULL,
  `role` text DEFAULT 'user' NOT NULL,
  `disabled_at` integer,
  `storage_quota_bytes` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_name_unique` ON `users` (`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_public_id_unique` ON `users` (`public_id`);
--> statement-breakpoint
CREATE TABLE `user_invites` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `email` text NOT NULL,
  `token_hash` text NOT NULL,
  `role` text DEFAULT 'user' NOT NULL,
  `expires_at` integer NOT NULL,
  `accepted_at` integer,
  `accepted_by_user_id` integer REFERENCES `users`(`id`) ON DELETE set null,
  `created_by_user_id` integer REFERENCES `users`(`id`) ON DELETE set null,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_invites_token_hash_unique` ON `user_invites` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `photos` (
  `id` text PRIMARY KEY NOT NULL,
  `source_type` text DEFAULT 'image' NOT NULL,
  `title` text,
  `description` text,
  `width` integer,
  `height` integer,
  `aspect_ratio` real,
  `date_taken` text,
  `storage_key` text,
  `display_storage_key` text,
  `display_mime_type` text,
  `display_file_size` integer,
  `display_width` integer,
  `display_height` integer,
  `thumbnail_key` text,
  `file_size` integer,
  `last_modified` text,
  `original_url` text,
  `thumbnail_url` text,
  `thumbnail_hash` text,
  `image_variants` text,
  `tags` text,
  `ai_tags` text,
  `ai_analysis` text,
  `exif` text,
  `latitude` real,
  `longitude` real,
  `country` text,
  `city` text,
  `location_name` text,
  `is_live_photo` integer DEFAULT 0 NOT NULL,
  `live_photo_video_url` text,
  `live_photo_video_key` text,
  `owner_user_id` integer REFERENCES `users`(`id`) ON DELETE set null,
  `visibility` text DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_id_unique` ON `photos` (`id`);
--> statement-breakpoint
CREATE TABLE `photo_assets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `photo_id` text NOT NULL REFERENCES `photos`(`id`) ON DELETE cascade,
  `kind` text DEFAULT 'uploaded-render' NOT NULL,
  `storage_key` text NOT NULL,
  `file_name` text NOT NULL,
  `mime_type` text NOT NULL,
  `file_size` integer NOT NULL,
  `width` integer NOT NULL,
  `height` integer NOT NULL,
  `is_primary` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_uploads` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `owner_user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `storage_key` text NOT NULL,
  `content_type` text,
  `size` integer NOT NULL,
  `status` text DEFAULT 'uploaded' NOT NULL,
  `task_id` integer,
  `photo_id` text,
  `error_message` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_uploads_storage_key_unique` ON `pending_uploads` (`storage_key`);
--> statement-breakpoint
CREATE TABLE `pipeline_queue` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `payload` text DEFAULT '{"type":"photo","storageKey":""}' NOT NULL,
  `priority` integer DEFAULT 0 NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `max_attempts` integer DEFAULT 3 NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `status_stage` text,
  `error_message` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `photo_reactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `photo_id` text NOT NULL REFERENCES `photos`(`id`) ON DELETE cascade,
  `reaction_type` text NOT NULL,
  `fingerprint` text NOT NULL,
  `ip_address` text,
  `user_agent` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `albums` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `cover_photo_id` text REFERENCES `photos`(`id`) ON DELETE set null,
  `owner_user_id` integer REFERENCES `users`(`id`) ON DELETE set null,
  `is_hidden` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `album_photos` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `album_id` integer NOT NULL REFERENCES `albums`(`id`) ON DELETE cascade,
  `photo_id` text NOT NULL REFERENCES `photos`(`id`) ON DELETE cascade,
  `position` real DEFAULT 1000000 NOT NULL,
  `added_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `people` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `owner_user_id` integer REFERENCES `users`(`id`) ON DELETE cascade,
  `name` text,
  `cover_photo_id` text REFERENCES `photos`(`id`) ON DELETE set null,
  `is_hidden` integer DEFAULT 1 NOT NULL,
  `is_favorite` integer DEFAULT 0 NOT NULL,
  `birth_date` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_people_owner_user_id` ON `people` (`owner_user_id`);
--> statement-breakpoint
CREATE TABLE `settings` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `namespace` text DEFAULT 'common' NOT NULL,
  `key` text NOT NULL,
  `type` text NOT NULL,
  `value` text,
  `default_value` text,
  `label` text,
  `description` text,
  `is_public` integer DEFAULT 0 NOT NULL,
  `is_readonly` integer DEFAULT 0 NOT NULL,
  `is_secret` integer DEFAULT 0 NOT NULL,
  `enum` text,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_by` integer REFERENCES `users`(`id`) ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_namespace_key` ON `settings` (`namespace`, `key`);
--> statement-breakpoint
CREATE TABLE `settings_storage_providers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `provider` text NOT NULL,
  `config` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
