ALTER TABLE `photos` ADD `timeline_day` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `date_source` text DEFAULT 'imported' NOT NULL;--> statement-breakpoint
CREATE INDEX `photos_owner_timeline` ON `photos` (`owner_id`,`timeline_day`,`created_at`,`id`);
--> statement-breakpoint
WITH dates AS (
  SELECT id,
    CASE WHEN json_extract(data,'$.capturedAt') GLOB '????-??-??T*' AND
      (json_extract(data,'$.capturedAt') GLOB '*Z' OR json_extract(data,'$.capturedAt') GLOB '*[+-]??:??')
      THEN strftime('%Y-%m-%d',json_extract(data,'$.capturedAt'),'+8 hours') END AS captured,
    CASE WHEN json_extract(data,'$.date') GLOB '????-??-??' AND date(json_extract(data,'$.date'))=json_extract(data,'$.date')
      THEN json_extract(data,'$.date') END AS recorded,
    strftime('%Y-%m-%d',created_at/1000.0,'unixepoch','+8 hours') AS imported,
    json_extract(data,'$.dateSource') AS source
  FROM photos
)
UPDATE photos SET timeline_day=coalesce(dates.captured,dates.recorded,dates.imported),
  date_source=CASE WHEN dates.captured IS NOT NULL THEN 'captured' WHEN dates.recorded IS NOT NULL THEN CASE WHEN dates.source='file-modified' THEN 'file-modified' ELSE 'record-date' END ELSE 'imported' END
FROM dates WHERE photos.id=dates.id;
