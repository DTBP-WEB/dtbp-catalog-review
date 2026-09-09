CREATE TABLE `review_sales_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hash` text NOT NULL,
	`payload` text NOT NULL,
	`imported_at` text NOT NULL,
	`imported_by` text NOT NULL
);
