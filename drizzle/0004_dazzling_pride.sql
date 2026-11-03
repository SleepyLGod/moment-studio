ALTER TABLE `library_owner` ADD `ai_state` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
UPDATE library_owner SET ai_state=(
  SELECT json_object('lastSuccessfulModelId',model_id,'lastSuccessAt',strftime('%Y-%m-%dT%H:%M:%fZ',updated_at/1000.0,'unixepoch'))
  FROM jobs WHERE owner_id=library_owner.user_id AND state='succeeded'
  ORDER BY updated_at DESC,id DESC LIMIT 1
) WHERE EXISTS(SELECT 1 FROM jobs WHERE owner_id=library_owner.user_id AND state='succeeded');
