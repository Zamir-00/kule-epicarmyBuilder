CREATE TABLE `magic_link_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer
);
--> statement-breakpoint
CREATE INDEX `magic_link_tokens_email_idx` ON `magic_link_tokens` (`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`list_id` text NOT NULL,
	`points_target` integer,
	`body` text NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_lists_owner_id_idx` ON `user_lists` (`owner_id`);--> statement-breakpoint
CREATE INDEX `user_lists_updated_at_idx` ON `user_lists` (`updated_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` integer NOT NULL,
	`last_sign_in_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);