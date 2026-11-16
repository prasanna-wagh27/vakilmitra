import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema.js";

export { and, asc, count, desc, eq, exists, gte, ilike, inArray, isNull, lt, lte, ne, not, or, sql } from "drizzle-orm";
export * from "./schema.js";
export { schema };

export type Db = NodePgDatabase<typeof schema>;

export function createDb(url: string, opts: { max?: number } = {}) {
  const pool = new pg.Pool({ connectionString: url, max: opts.max ?? 10 });
  const db = drizzle(pool, { schema, casing: "snake_case" });
  return { db, pool };
}

/** Apply migrations from packages/db/migrations (used by tests and deploys). */
export async function runMigrations(url: string) {
  const { db, pool } = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
  } finally {
    await pool.end();
  }
}
