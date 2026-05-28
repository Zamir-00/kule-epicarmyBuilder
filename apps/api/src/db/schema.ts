import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id:              text('id').primaryKey(),                     // ulid
  email:           text('email').notNull().unique(),
  display_name:    text('display_name'),
  created_at:      integer('created_at').notNull(),             // ms
  last_sign_in_at: integer('last_sign_in_at'),                  // ms or null
});

export const magicLinkTokens = sqliteTable('magic_link_tokens', {
  token_hash:  text('token_hash').primaryKey(),                  // sha256 hex
  email:       text('email').notNull(),
  created_at:  integer('created_at').notNull(),
  expires_at:  integer('expires_at').notNull(),
  consumed_at: integer('consumed_at'),
}, (t) => ({
  emailIdx: index('magic_link_tokens_email_idx').on(t.email),
}));

export const sessions = sqliteTable('sessions', {
  id:           text('id').primaryKey(),                          // ulid; also cookie value
  user_id:      text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at:   integer('created_at').notNull(),
  expires_at:   integer('expires_at').notNull(),
  last_seen_at: integer('last_seen_at').notNull(),
  user_agent:   text('user_agent'),
}, (t) => ({
  userIdIdx: index('sessions_user_id_idx').on(t.user_id),
}));

export const userLists = sqliteTable('user_lists', {
  id:            text('id').primaryKey(),                          // ulid
  owner_id:      text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title:         text('title').notNull(),
  list_id:       text('list_id').notNull(),                        // FK-by-string to war/lists/*.json list_id
  points_target: integer('points_target'),
  body:          text('body', { mode: 'json' }).notNull(),         // opaque JSON
  is_public:     integer('is_public', { mode: 'boolean' }).notNull().default(false),
  created_at:    integer('created_at').notNull(),
  updated_at:    integer('updated_at').notNull(),
}, (t) => ({
  ownerIdIdx:   index('user_lists_owner_id_idx').on(t.owner_id),
  updatedAtIdx: index('user_lists_updated_at_idx').on(t.updated_at),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type UserList = typeof userLists.$inferSelect;
export type NewUserList = typeof userLists.$inferInsert;
