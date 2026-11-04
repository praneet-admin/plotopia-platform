CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text,
	`staff_name` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`summary` text NOT NULL,
	`diff` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_created` ON `activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `cinemas` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `cinemas` ADD `map_url` text;--> statement-breakpoint
ALTER TABLE `cinemas` ADD `hours` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `blocked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `movies` ADD `poster_url` text;--> statement-breakpoint
ALTER TABLE `movies` ADD `trailer_url` text;--> statement-breakpoint
ALTER TABLE `movies` ADD `formats` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `movies` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `screens` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `seats` ADD `blocked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shows` ADD `deleted_at` integer;