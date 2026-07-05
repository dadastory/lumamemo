ALTER TABLE `photos` ADD `source_type` text DEFAULT 'image' NOT NULL;
ALTER TABLE `photos` ADD `display_storage_key` text;
ALTER TABLE `photos` ADD `display_mime_type` text;
ALTER TABLE `photos` ADD `display_file_size` integer;
ALTER TABLE `photos` ADD `display_width` integer;
ALTER TABLE `photos` ADD `display_height` integer;
--> statement-breakpoint
CREATE TABLE `photo_assets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `photo_id` text NOT NULL,
  `kind` text DEFAULT 'uploaded-render' NOT NULL,
  `storage_key` text NOT NULL,
  `file_name` text NOT NULL,
  `mime_type` text NOT NULL,
  `file_size` integer NOT NULL,
  `width` integer NOT NULL,
  `height` integer NOT NULL,
  `is_primary` integer DEFAULT false NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade
);
