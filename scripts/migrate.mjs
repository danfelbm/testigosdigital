// Ejecuta las migraciones SQL (idempotentes) en orden.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createDbClient } from "./db.mjs";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const archivos = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (archivos.length === 0) {
  console.error("✗ No hay migraciones en supabase/migrations/");
  process.exit(1);
}

const client = createDbClient();
await client.connect();
try {
  for (const archivo of archivos) {
    const sql = readFileSync(join(MIGRATIONS_DIR, archivo), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`✓ ${archivo}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`✗ ${archivo}: ${err.message}`);
      process.exit(1);
    }
  }
} finally {
  await client.end();
}
console.log("Migraciones aplicadas.");
