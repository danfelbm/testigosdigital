// Helper compartido de los scripts de BD.
// Los scripts usan session mode (5432); la app usa transaction mode (6543).
import pg from "pg";

export function createDbClient() {
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) {
    console.error("✗ Falta SUPABASE_DB_URL en .env.local (ver .env.example)");
    process.exit(1);
  }
  const connectionString = raw.replace(":6543/", ":5432/");
  return new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

export const BATCH_SIZE = 1000;

/**
 * Upsert por lotes dentro de una transacción.
 * rows: array de arrays de valores; columns: nombres de columna.
 * updateSet: cláusula SET del ON CONFLICT.
 */
export async function upsertBatches(client, table, columns, rows, updateSet) {
  await client.query("BEGIN");
  try {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = batch
        .map((row, r) => {
          const ps = row.map((v, c) => {
            values.push(v);
            return `$${r * row.length + c + 1}`;
          });
          return `(${ps.join(", ")})`;
        })
        .join(", ");
      await client.query(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}
         ON CONFLICT (cedula) DO UPDATE SET ${updateSet}`,
        values
      );
      process.stdout.write(
        `\r  upsert ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`
      );
    }
    await client.query("COMMIT");
    process.stdout.write("\n");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export function normalizarCedula(valor) {
  const limpia = String(valor ?? "").replace(/\D/g, "");
  return /^[0-9]{4,11}$/.test(limpia) ? limpia : null;
}

export function limpiarNombre(...partes) {
  return partes
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}
