CREATE TABLE `style_event_subscriptions` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`callback_url` text NOT NULL,
	`secret` text NOT NULL,
	`previous_secret` text,
	`rotate_until` integer,
	`expires_at` integer NOT NULL,
	`verified_at` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	`renewed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `style_event_subscriptions_id_unique` ON `style_event_subscriptions` (`id`);