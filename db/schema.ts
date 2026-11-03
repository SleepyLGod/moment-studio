import {sqliteTable, text, integer, index, uniqueIndex} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';

export const owner = sqliteTable('library_owner', {
  id: integer('id').primaryKey(), userId: text('user_id').notNull(), initialized: integer('initialized').notNull().default(0),
});
export const files = sqliteTable('files', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(),
  name: text('name').notNull(), mime: text('mime').notNull(), size: integer('size').notNull(),
  objectKey: text('object_key').notNull(), purpose: text('purpose').notNull(),
  status: text('status').notNull(), createdAt: integer('created_at').notNull(),
}, table=>[index('files_owner').on(table.ownerId)]);
function records(name: string) {
  return sqliteTable(name, {
    id: text('id').primaryKey(), ownerId: text('owner_id').notNull(),
    data: text('data').notNull(), revision: integer('revision').notNull().default(1),
    createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
  }, table=>[index(name+'_owner_order').on(table.ownerId,table.createdAt,table.id),...(name==='photos'?[index('photos_owner_category_order').on(table.ownerId,sql`json_extract(${table.data}, '$.category')`,table.createdAt,table.id)]:[])]);
}
export const photos = records('photos');
export const albums = records('albums');
export const styles = records('styles');

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), workKey: text('work_key').notNull(),
  kind: text('kind').notNull(), photoId: text('photo_id').notNull(), input: text('input').notNull(),
  modelId: text('model_id').notNull(), state: text('state').notNull(), attempts: integer('attempts').notNull().default(0),
  nextRunAt: integer('next_run_at').notNull(), leaseToken: text('lease_token'), leaseUntil: integer('lease_until'),
  result: text('result'), errorCode: text('error_code'), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, table=>[uniqueIndex('jobs_owner_work').on(table.ownerId,table.workKey),index('jobs_due').on(table.state,table.nextRunAt),index('jobs_owner_created').on(table.ownerId,table.createdAt)]);
