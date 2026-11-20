/**
 * Backups by hand. In production use the built file: node dist/backup-cli.js <command>.
 *
 *   backup                                   take a backup now
 *   list                                     list backups in the backup store
 *   check [--run <id>]                       restore into BACKUP_RESTORE_CHECK_URL and compare
 *   restore --to <database url> [--run <id>] [--files]
 *       restore the database (default: the newest backup) into a new, empty database;
 *       --files also copies the client files back into the live store (STORAGE_* settings)
 */
import { parseArgs } from "node:util";
import { createDb } from "@vakilmitra/db";
import { backupStorageConfigFromEnv, createBlobStore, parseMasterKeys, storageConfigFromEnv } from "@vakilmitra/storage";
import pino from "pino";
import { checkRestore, listRuns, pickRun, restoreDatabase, restoreFiles, runBackup } from "./backup.js";
import { loadEnv } from "./env.js";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { to: { type: "string" }, run: { type: "string" }, files: { type: "boolean" } },
});
const env = loadEnv();
const log = pino({ level: env.LOG_LEVEL, transport: env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" } });
const liveCfg = storageConfigFromEnv(process.env);
const backupCfg = backupStorageConfigFromEnv(process.env);
if (!backupCfg) {
  console.error("BACKUP_STORAGE_DRIVER is not set (see README, Backups)");
  process.exit(1);
}
const live = createBlobStore(liveCfg);
const backup = createBlobStore(backupCfg);
const masterKeys = parseMasterKeys(liveCfg.masterKeys);

async function main() {
  const command = positionals[0];
  if (command === "list") {
    for (const r of await listRuns(backup)) console.log(`${r.id}  ${r.done ? "complete" : "unfinished"}`);
    return;
  }
  if (command === "restore") {
    if (!values.to) throw new Error("Give the database to restore into: --to <database url>");
    const id = await pickRun(backup, values.run);
    await restoreDatabase(backup, masterKeys, id, values.to);
    console.log(`Database restored from ${id}`);
    if (values.files) {
      const r = await restoreFiles(backup, live, masterKeys, id);
      console.log(`Files: ${r.copied} copied back, ${r.files - r.copied} were already there`);
    }
    return;
  }
  // backup and check record their result in the live database.
  const { db, pool } = createDb(env.DATABASE_URL, { max: 2 });
  try {
    const deps = { db, databaseUrl: env.DATABASE_URL, live, backup, masterKeys, log };
    if (command === "backup") console.log(`Backup ${await runBackup(deps)} done`);
    else if (command === "check") {
      if (!env.BACKUP_RESTORE_CHECK_URL) throw new Error("Set BACKUP_RESTORE_CHECK_URL");
      console.log(`Restore check passed for ${await checkRestore(deps, env.BACKUP_RESTORE_CHECK_URL, values.run)}`);
    } else throw new Error("Commands: backup, list, check, restore (see the top of src/backup-cli.ts)");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
