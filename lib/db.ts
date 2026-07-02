import { Pool } from "pg";

// Pool singleton contra el pooler de Supabase en modo transacción (6543).
// Se cuelga de globalThis para sobrevivir el hot-reload de next dev.
const globalForPool = globalThis as unknown as { __testigosPool?: Pool };

export function getPool(): Pool {
  if (!globalForPool.__testigosPool) {
    const connectionString = process.env.SUPABASE_DB_URL;
    if (!connectionString) {
      throw new Error("SUPABASE_DB_URL no está configurada");
    }
    globalForPool.__testigosPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return globalForPool.__testigosPool;
}
