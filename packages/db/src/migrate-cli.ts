/**
 * Applies pending migrations to DATABASE_URL and exits. Deploys run it once before the API
 * and worker start (the `migrate` service in deploy/compose.yml): node packages/db/dist/migrate-cli.js
 */
import { runMigrations } from "./index.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
await runMigrations(url);
console.log("Database migrations are up to date");
