ALTER TABLE `reading_completion` ADD `is_extra` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- CHECK hand-written inline: drizzle-kit would rebuild reading_plan to add it (see schema.ts).
ALTER TABLE `reading_plan` ADD `read_through` integer DEFAULT 1 NOT NULL CHECK (`read_through` >= 1);