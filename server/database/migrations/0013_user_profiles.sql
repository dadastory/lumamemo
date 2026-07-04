ALTER TABLE `users` ADD `public_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_title` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_slogan` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `homepage_visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_public_id_unique` ON `users` (`public_id`);
