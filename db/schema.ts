import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const state = sqliteTable('review_state', { id: integer('id').primaryKey(), revision: integer('revision').notNull().default(0), ready: integer('ready').notNull().default(0), metadata: text('metadata').notNull(), ownerId: text('owner_id') });
export const items = sqliteTable('review_items', { id: text('id').primaryKey(), fingerprint: text('fingerprint').notNull(), group: text('review_group').notNull(), position: integer('position').notNull(), payload: text('payload').notNull() });
export const decisions = sqliteTable('review_decisions', { id: text('id').primaryKey(), payload: text('payload').notNull() });
export const history = sqliteTable('review_history', { revision: integer('revision').primaryKey(), requestId: text('request_id').notNull(), itemId: text('item_id').notNull(), payload: text('payload').notNull() }, (table) => [uniqueIndex('review_history_request_id').on(table.requestId)]);
