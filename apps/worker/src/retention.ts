/**
 * How long records are kept. Activity records (access_log) are deleted after one year, in
 * small batches so the table is never locked for long. The anonymous record that an account
 * was deleted is kept: it is the proof that the erasure happened.
 */
import { accessLogs, and, type Db, inArray, lt, ne } from "@vakilmitra/db";

export const ACTIVITY_KEEP_DAYS = 365;
const BATCH = 5_000;

export async function pruneActivity(db: Db, now = new Date()) {
  const cutoff = new Date(now.getTime() - ACTIVITY_KEEP_DAYS * 86_400_000);
  let deleted = 0;
  for (;;) {
    const old = db
      .select({ id: accessLogs.id })
      .from(accessLogs)
      .where(and(lt(accessLogs.at, cutoff), ne(accessLogs.action, "account.delete")))
      .limit(BATCH);
    const gone = await db.delete(accessLogs).where(inArray(accessLogs.id, old)).returning({ id: accessLogs.id });
    deleted += gone.length;
    if (gone.length < BATCH) return { deleted, cutoff };
  }
}
