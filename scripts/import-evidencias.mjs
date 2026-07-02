// Importa el CSV de evidencias (agregado por cédula) a testigos_evidencias.
// Presencia en esta tabla = cédula validada para pago. Un testigo puede cubrir
// varias mesas → se agrega y solo se guarda cedula, nombre y num_mesas
// (minimización deliberada: teléfonos, correos y datos electorales NO se cargan).
// Idempotente. Uso: npm run db:import:evidencias [-- /ruta/al.csv]
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { createDbClient, upsertBatches, normalizarCedula, limpiarNombre } from "./db.mjs";

const RUTA =
  process.argv[2] ?? "/Users/testuser/Desktop/evidencias-consolidado-2026-07-02-183707.csv";
const COL_CEDULA = "Cédula";
const COL_NOMBRE = "Nombre";

const crudo = readFileSync(RUTA, "utf8").replace(/^\uFEFF/, "");
const { data: filas, errors } = Papa.parse(crudo, {
  header: true,
  skipEmptyLines: true,
});
if (errors.length > 0) {
  console.warn(`⚠ ${errors.length} advertencias de parseo (primera: ${errors[0].message})`);
}
if (filas.length === 0 || !(COL_CEDULA in filas[0])) {
  console.error(
    `✗ Estructura inesperada: no se encontró la columna "${COL_CEDULA}". ` +
      `Columnas vistas: ${Object.keys(filas[0] ?? {}).join(" | ")}`
  );
  process.exit(1);
}

let descartadas = 0;
const porCedula = new Map();
for (const fila of filas) {
  const cedula = normalizarCedula(fila[COL_CEDULA]);
  if (!cedula) {
    descartadas++;
    continue;
  }
  const existente = porCedula.get(cedula);
  if (existente) {
    existente.numMesas++;
    if (!existente.nombre) existente.nombre = limpiarNombre(fila[COL_NOMBRE]);
  } else {
    porCedula.set(cedula, { nombre: limpiarNombre(fila[COL_NOMBRE]), numMesas: 1 });
  }
}

console.log(
  `Leídas ${filas.length} filas — ${porCedula.size} cédulas únicas, ${descartadas} descartadas`
);

const rows = [...porCedula.entries()].map(([cedula, { nombre, numMesas }]) => [
  cedula,
  nombre || "SIN NOMBRE",
  numMesas,
]);

const client = createDbClient();
await client.connect();
try {
  await upsertBatches(
    client,
    "public.testigos_evidencias",
    ["cedula", "nombre", "num_mesas"],
    rows,
    "nombre = EXCLUDED.nombre, num_mesas = EXCLUDED.num_mesas, updated_at = NOW()"
  );
  const { rows: total } = await client.query(
    "SELECT count(*)::int AS n FROM testigos_evidencias"
  );
  const { rows: muestra } = await client.query(
    `SELECT e.cedula FROM testigos_evidencias e
     WHERE NOT EXISTS (SELECT 1 FROM testigos_giros g WHERE g.cedula = e.cedula)
     LIMIT 3`
  );
  console.log(`✓ testigos_evidencias: ${total[0].n} filas totales`);
  console.log(
    `  Cédulas de muestra (en_proceso, sin giro): ${muestra.map((r) => r.cedula).join(", ") || "(ninguna aún)"}`
  );
} finally {
  await client.end();
}
