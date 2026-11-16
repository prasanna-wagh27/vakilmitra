import { execSync } from "node:child_process";

/** Apply migrations to the test database (non-destructive; tests use unique data). */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://vakilmitra:vakilmitra@localhost:5432/vakilmitra_test";
  execSync("npx prisma migrate deploy", { stdio: "ignore", env: { ...process.env, DATABASE_URL: url } });
}
