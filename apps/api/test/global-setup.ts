import { runMigrations } from "@vakilmitra/db";

/** Apply migrations to the test database (non-destructive; tests create unique data). */
export default async function setup() {
  await runMigrations(process.env.TEST_DATABASE_URL ?? "postgresql://vakilmitra:vakilmitra@localhost:5432/vakilmitra_test");
}
