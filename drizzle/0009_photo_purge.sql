CREATE TABLE `photo_purges` (
	`photo_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`file_ids` text NOT NULL,
	`completed_at` integer
);
