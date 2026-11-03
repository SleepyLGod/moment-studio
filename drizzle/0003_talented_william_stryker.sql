CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`work_key` text NOT NULL,
	`kind` text NOT NULL,
	`photo_id` text NOT NULL,
	`input` text NOT NULL,
	`model_id` text NOT NULL,
	`state` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_run_at` integer NOT NULL,
	`lease_token` text,
	`lease_until` integer,
	`result` text,
	`error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_owner_work` ON `jobs` (`owner_id`,`work_key`);--> statement-breakpoint
CREATE INDEX `jobs_due` ON `jobs` (`state`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `jobs_owner_created` ON `jobs` (`owner_id`,`created_at`);