import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, lt, desc, or } from 'drizzle-orm';
import { ulid } from 'ulid';
import { router, procedure, authedProcedure } from './router.js';
import { userLists } from '../db/schema.js';
import { getValidListIds } from '../catalog/list-ids.js';

const MAX_LIST_TITLE_LEN = 200;
const MAX_LIST_BODY_BYTES = 256 * 1024;   // 256 KB cap on body JSON (generous; army lists are tiny)
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const saveInput = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(MAX_LIST_TITLE_LEN),
  list_id: z.string().min(1),
  points_target: z.number().int().nonnegative().optional(),
  body: z.unknown(),
  is_public: z.boolean().optional(),
});

const loadInput = z.object({ id: z.string().min(1) });

const listMineInput = z.object({
  limit: z.number().int().positive().max(MAX_PAGE_SIZE).optional(),
  cursor: z.object({
    updated_at: z.number().int(),
    id: z.string(),
  }).optional(),
}).default({});

const setVisibilityInput = z.object({
  id: z.string().min(1),
  is_public: z.boolean(),
});

const deleteInput = z.object({ id: z.string().min(1) });

function assertBodySize(body: unknown): void {
  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_LIST_BODY_BYTES) {
    throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: `list body exceeds ${MAX_LIST_BODY_BYTES} bytes` });
  }
}

export const listsRouter = router({
  save: authedProcedure
    .input(saveInput)
    .mutation(async ({ ctx, input }) => {
      // Validate list_id against catalog
      const validIds = await getValidListIds();
      if (!validIds.has(input.list_id)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `list_id not found in catalog: ${input.list_id}`,
        });
      }

      assertBodySize(input.body);

      const now = Date.now();

      if (input.id) {
        // Update existing
        const existing = ctx.db.select().from(userLists).where(eq(userLists.id, input.id)).get();
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'list not found' });
        }
        if (existing.owner_id !== ctx.user.id) {
          // Don't leak existence — return NOT_FOUND, not FORBIDDEN
          throw new TRPCError({ code: 'NOT_FOUND', message: 'list not found' });
        }
        ctx.db.update(userLists).set({
          title: input.title,
          list_id: input.list_id,
          points_target: input.points_target ?? null,
          body: input.body as object,
          is_public: input.is_public ?? existing.is_public,
          updated_at: now,
        }).where(eq(userLists.id, input.id)).run();

        const updated = ctx.db.select().from(userLists).where(eq(userLists.id, input.id)).get();
        if (!updated) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'update failed' });
        return updated;
      }

      // Create new
      const id = ulid();
      ctx.db.insert(userLists).values({
        id,
        owner_id: ctx.user.id,
        title: input.title,
        list_id: input.list_id,
        points_target: input.points_target ?? null,
        body: input.body as object,
        is_public: input.is_public ?? false,
        created_at: now,
        updated_at: now,
      }).run();

      const created = ctx.db.select().from(userLists).where(eq(userLists.id, id)).get();
      if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'create failed' });
      return created;
    }),

  load: procedure
    .input(loadInput)
    .query(({ ctx, input }) => {
      const row = ctx.db.select().from(userLists).where(eq(userLists.id, input.id)).get();
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'list not found' });
      }
      const isOwner = ctx.user && ctx.user.id === row.owner_id;
      if (!row.is_public && !isOwner) {
        // Don't leak existence
        throw new TRPCError({ code: 'NOT_FOUND', message: 'list not found' });
      }
      return row;
    }),

  listMine: authedProcedure
    .input(listMineInput)
    .query(({ ctx, input }) => {
      const limit = input.limit ?? DEFAULT_PAGE_SIZE;
      // Order: updated_at DESC, then id DESC as tiebreaker (ULIDs sort lexically so this is stable).
      // Cursor pagination: rows AFTER the cursor (i.e. older).
      let where = eq(userLists.owner_id, ctx.user.id);
      if (input.cursor) {
        // (updated_at, id) < (cursor.updated_at, cursor.id)  lexicographically
        where = and(
          where,
          or(
            lt(userLists.updated_at, input.cursor.updated_at),
            and(eq(userLists.updated_at, input.cursor.updated_at), lt(userLists.id, input.cursor.id)),
          ),
        )!;
      }
      const rows = ctx.db.select().from(userLists)
        .where(where)
        .orderBy(desc(userLists.updated_at), desc(userLists.id))
        .limit(limit + 1)
        .all();

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore && items.length > 0
        ? { updated_at: items[items.length - 1]!.updated_at, id: items[items.length - 1]!.id }
        : null;

      return { items, nextCursor };
    }),

  setVisibility: authedProcedure
    .input(setVisibilityInput)
    .mutation(({ ctx, input }) => {
      const existing = ctx.db.select().from(userLists).where(eq(userLists.id, input.id)).get();
      if (!existing || existing.owner_id !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'list not found' });
      }
      ctx.db.update(userLists).set({
        is_public: input.is_public,
        updated_at: Date.now(),
      }).where(eq(userLists.id, input.id)).run();
      const updated = ctx.db.select().from(userLists).where(eq(userLists.id, input.id)).get()!;
      return updated;
    }),

  delete: authedProcedure
    .input(deleteInput)
    .mutation(({ ctx, input }) => {
      const existing = ctx.db.select().from(userLists).where(eq(userLists.id, input.id)).get();
      if (!existing || existing.owner_id !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'list not found' });
      }
      ctx.db.delete(userLists).where(eq(userLists.id, input.id)).run();
      return { ok: true as const };
    }),
});
