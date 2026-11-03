import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(), title: text('title').notNull(), content: text('content').notNull(),
  excerpt: text('excerpt').notNull().default(''), category: text('category').notNull().default('article'),
  status: text('status').notNull().default('draft'), tags: text('tags').notNull().default('[]'),
  cover: text('cover').notNull().default(''), authorId: text('author_id').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
  publishedAt: text('published_at'), version: integer('version').notNull().default(1),
  pageKey: text('page_key'), trashedAt: text('trashed_at'), previousStatus: text('previous_status'),
}, t => [index('posts_public').on(t.status,t.publishedAt)]);
export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(), objectKey: text('object_key').notNull(),
  mime: text('mime').notNull(), size: integer('size').notNull(),
  authorId: text('author_id').notNull(), createdAt: text('created_at').notNull(),
});
