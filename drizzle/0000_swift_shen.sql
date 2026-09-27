CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`school` text NOT NULL,
	`category` text NOT NULL,
	`meta` text NOT NULL,
	`tags` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`user_id` text NOT NULL,
	`term` text NOT NULL,
	`instructor` text NOT NULL,
	`body` text NOT NULL,
	`rating` integer NOT NULL,
	`m1` integer NOT NULL,
	`m2` integer NOT NULL,
	`m3` integer NOT NULL,
	`hours` real NOT NULL,
	`recommend` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_user_item` ON `reviews` (`user_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `reviews_item` ON `reviews` (`item_id`);