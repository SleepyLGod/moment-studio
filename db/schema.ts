import {sqliteTable, text, integer, index} from 'drizzle-orm/sqlite-core';

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
  }, table=>[index(name+'_owner_order').on(table.ownerId,table.createdAt,table.id)]);
}
export const photos = records('photos');
export const albums = records('albums');
export const styles = records('styles');
