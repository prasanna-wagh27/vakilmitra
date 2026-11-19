import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema.js";

export { and, asc, count, countDistinct, desc, eq, exists, gte, ilike, inArray, isNull, lt, lte, ne, not, or, sql, sum } from "drizzle-orm";
export * from "./schema.js";
export { schema };

export type Db = NodePgDatabase<typeof schema>;

export function createDb(url: string, opts: { max?: number } = {}) {
  const pool = new pg.Pool({ connectionString: url, max: opts.max ?? 10 });
  const db = drizzle(pool, { schema, casing: "snake_case" });
  return { db, pool };
}

/** Any fixed number: all migrators take the same Postgres advisory lock. */
const MIGRATION_LOCK_ID = 727_100_001;

/**
 * Apply migrations from packages/db/migrations (used by tests and deploys).
 * Concurrent callers (parallel test suites, several app instances starting at once) are
 * serialised with a session advisory lock; without it they race on CREATE TYPE/SCHEMA and fail.
 */
export async function runMigrations(url: string) {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    try {
      // Same connection as the lock: the pool has exactly one client.
      await migrate(drizzle(client, { schema, casing: "snake_case" }), {
        migrationsFolder: new URL("../migrations", import.meta.url).pathname,
      });
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    }
  } finally {
    client.release();
    await pool.end();
  }
}
