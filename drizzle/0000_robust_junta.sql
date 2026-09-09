CREATE TABLE `review_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_history` (
	`revision` integer PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`item_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_history_request_id` ON `review_history` (`request_id`);--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`review_group` text NOT NULL,
	`position` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`metadata` text NOT NULL,
	`owner_id` text
);
