CREATE TABLE `app_setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_completion` (
	`id` text PRIMARY KEY NOT NULL,
	`reading_plan_id` text NOT NULL,
	`local_date` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter` integer NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`reading_plan_id`) REFERENCES `reading_plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_completion_day_chapter_unique` ON `reading_completion` (`local_date`,`book_id`,`chapter`);--> statement-breakpoint
CREATE INDEX `reading_completion_local_date_idx` ON `reading_completion` (`local_date`);--> statement-breakpoint
CREATE TABLE `reading_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`canon_id` text DEFAULT 'protestant' NOT NULL,
	`start_date` text NOT NULL,
	`start_book_id` text NOT NULL,
	`start_chapter` integer NOT NULL,
	`chapters_per_day` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`end_date` text
);
