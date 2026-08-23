PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reading_completion` (
	`id` text PRIMARY KEY NOT NULL,
	`reading_plan_id` text NOT NULL,
	`local_date` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter` integer NOT NULL,
	`from_verse` integer DEFAULT 0 NOT NULL,
	`to_verse` integer DEFAULT 0 NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`reading_plan_id`) REFERENCES `reading_plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reading_completion`("id", "reading_plan_id", "local_date", "book_id", "chapter", "from_verse", "to_verse", "completed_at") SELECT "id", "reading_plan_id", "local_date", "book_id", "chapter", 0, 0, "completed_at" FROM `reading_completion`;--> statement-breakpoint
DROP TABLE `reading_completion`;--> statement-breakpoint
ALTER TABLE `__new_reading_completion` RENAME TO `reading_completion`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `reading_completion_day_span_unique` ON `reading_completion` (`local_date`,`book_id`,`chapter`,`from_verse`,`to_verse`);--> statement-breakpoint
CREATE INDEX `reading_completion_local_date_idx` ON `reading_completion` (`local_date`);