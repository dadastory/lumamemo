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
CREATE INDEX `idx_user_invites_email` ON `user_invites` (`email`);
