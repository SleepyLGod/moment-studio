CREATE INDEX `photos_owner_category_order` ON `photos` (`owner_id`,json_extract(`data`, '$.category'),`created_at`,`id`);
