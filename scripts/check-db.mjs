// Verifica disponibilidad de la BD antes de migrar/importar.
import { createDbClient } from "./db.mjs";

const client = createDbClient();
try {
  await client.connect();
  const { rows } = await client.query("SELECT version()");
  console.log(`✓ Postgres directo OK — ${rows[0].version.split(",")[0]}`);
} catch (err) {
  console.error(`✗ No hay conexión Postgres directa: ${err.message}`);
  process.exit(1);
} finally {
  await client.end();
}

// Chequeo informativo (NO bloqueante) del estado de la API REST:
// este proyecto no la usa, pero otros proyectos de la instancia sí.
const restUrl = process.env.SUPABASE_URL;
if (restUrl) {
  try {
    const res = await fetch(`${restUrl}/rest/v1/`, { method: "HEAD" });
    if (res.status === 402) {
      console.warn(
        "⚠ La API REST de Supabase sigue restringida por cuota (402). " +
          "No afecta a este proyecto, pero sí a otros que usan la API REST."
      );
    } else {
      console.log(`✓ API REST responde (HTTP ${res.status})`);
    }
  } catch {
    console.warn("⚠ No se pudo contactar la API REST (informativo)");
  }
}
