// Importa el CSV de listado de testigos registrados a testigos_listado.
// Presencia en esta tabla = la persona está registrada como testigo (cualquier
// estado del registro). Solo se cargan cédula y nombre — minimización de datos:
// emails, teléfonos, fechas de nacimiento y demás columnas NO se importan.
// Idempotente. Uso: npm run db:import:listado [-- /ruta/al.csv]
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { createDbClient, upsertBatches, normalizarCedula, limpiarNombre } from "./db.mjs";

const RUTA =
  process.argv[2] ?? "/Users/testuser/Desktop/testigos-listado-2026-07-03-014451.csv";
const COL_CEDULA = "Documento";

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
  const nombre = limpiarNombre(
    fila["Primer Nombre"],
    fila["Segundo Nombre"],
    fila["Primer Apellido"],
    fila["Segundo Apellido"]
  );
  const existente = porCedula.get(cedula);
  if (!existente) {
    porCedula.set(cedula, nombre || "SIN NOMBRE");
  } else if (existente === "SIN NOMBRE" && nombre) {
    porCedula.set(cedula, nombre);
  }
}

console.log(
  `Leídas ${filas.length} filas — ${porCedula.size} cédulas únicas, ${descartadas} descartadas`
);

const rows = [...porCedula.entries()];
const client = createDbClient();
await client.connect();
try {
  await upsertBatches(
    client,
    "public.testigos_listado",
    ["cedula", "nombre"],
    rows,
    "nombre = EXCLUDED.nombre, updated_at = NOW()"
  );
  const { rows: total } = await client.query(
    "SELECT count(*)::int AS n FROM testigos_listado"
  );
  const { rows: muestra } = await client.query(
    `SELECT l.cedula FROM testigos_listado l
     WHERE NOT EXISTS (SELECT 1 FROM testigos_giros g WHERE g.cedula = l.cedula)
       AND NOT EXISTS (SELECT 1 FROM testigos_evidencias e WHERE e.cedula = l.cedula)
     LIMIT 3`
  );
  console.log(`✓ testigos_listado: ${total[0].n} filas totales`);
  console.log(
    `  Cédulas de muestra (sin_evidencia): ${muestra.map((r) => r.cedula).join(", ") || "(ninguna)"}`
  );
} finally {
  await client.end();
}
