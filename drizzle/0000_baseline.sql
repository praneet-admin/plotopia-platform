CREATE TABLE IF NOT EXISTS `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`customer_id` text,
	`hold_group` text,
	`status` text NOT NULL,
	`channel` text DEFAULT 'online' NOT NULL,
	`seat_labels` text NOT NULL,
	`subtotal` integer NOT NULL,
	`fee` integer NOT NULL,
	`total` integer NOT NULL,
	`refund_amount` integer DEFAULT 0 NOT NULL,
	`qr_token` text NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	`cancelled_at` integer,
	`created_by` text,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `bookings_qr_token_unique` ON `bookings` (`qr_token`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bookings_show` ON `bookings` (`show_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bookings_customer` ON `bookings` (`customer_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cinemas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`address` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customers_phone_unique` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `movies` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`language` text NOT NULL,
	`certificate` text NOT NULL,
	`runtime_min` integer NOT NULL,
	`genre` text NOT NULL,
	`synopsis` text NOT NULL,
	`cast` text NOT NULL,
	`director` text NOT NULL,
	`release_date` text NOT NULL,
	`accent` text NOT NULL,
	`accent2` text NOT NULL,
	`rating` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'now_showing' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `movies_slug_unique` ON `movies` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`booking_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`status` text NOT NULL,
	`gateway_ref` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `payments_idempotency_key_unique` ON `payments` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pricing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`day_type` text NOT NULL,
	`from_hour` integer NOT NULL,
	`to_hour` integer NOT NULL,
	`multiplier` real NOT NULL,
	`screen_id` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `screens` (
	`id` text PRIMARY KEY NOT NULL,
	`cinema_id` text NOT NULL,
	`name` text NOT NULL,
	`layout` text NOT NULL,
	`seat_count` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`cinema_id`) REFERENCES `cinemas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `seat_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`seat_id` text NOT NULL,
	`hold_group` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seat_id`) REFERENCES `seats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `holds_show_seat` ON `seat_holds` (`show_id`,`seat_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `holds_group` ON `seat_holds` (`hold_group`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `seats` (
	`id` text PRIMARY KEY NOT NULL,
	`screen_id` text NOT NULL,
	`label` text NOT NULL,
	`row` text NOT NULL,
	`row_index` integer NOT NULL,
	`num` integer NOT NULL,
	`category` text NOT NULL,
	`aisle_after` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`screen_id`) REFERENCES `screens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `seats_screen` ON `seats` (`screen_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `shows` (
	`id` text PRIMARY KEY NOT NULL,
	`movie_id` text NOT NULL,
	`screen_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`format` text DEFAULT '2D' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`prices` text NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`screen_id`) REFERENCES `screens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `shows_starts` ON `shows` (`starts_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `shows_screen` ON `shows` (`screen_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `staff_email_unique` ON `staff` (`email`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`show_id` text NOT NULL,
	`seat_id` text NOT NULL,
	`seat_label` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`checked_in_at` integer,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seat_id`) REFERENCES `seats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tickets_show_seat_active` ON `tickets` (`show_id`,`seat_id`) WHERE active = 1;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tickets_booking` ON `tickets` (`booking_id`);