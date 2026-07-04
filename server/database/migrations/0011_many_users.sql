ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `disabled_at` integer;--> statement-breakpoint
UPDATE `users` SET `role` = 'admin' WHERE `is_admin` = 1;--> statement-breakpoint
ALTER TABLE `photos` ADD `owner_user_id` integer REFERENCES `users`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `photos` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
UPDATE `photos` SET `visibility` = 'public';--> statement-breakpoint
ALTER TABLE `albums` ADD `owner_user_id` integer REFERENCES `users`(`id`) ON DELETE set null;
