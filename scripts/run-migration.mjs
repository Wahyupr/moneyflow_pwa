// Applies a single SQL migration file against DATABASE_URL.
// Usage: node scripts/run-migration.mjs <path-to-sql>
import pg from "pg";
import { readFileSync } from "node:fs";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const env = readFileSync(".env.local", "utf8");
  const match = env.match(/^DATABASE_URL=(.*)$/m);
  if (!match) {
    throw new Error("DATABASE_URL not found in environment or .env.local");
  }
  return match[1].trim();
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-migration.mjs <path-to-sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const pool = new pg.Pool({
  connectionString: loadDatabaseUrl(),
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

try {
  await pool.query(sql);
  console.log(`Applied migration: ${file}`);
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
