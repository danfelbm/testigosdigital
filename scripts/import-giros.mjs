// Importa "BD CARGUE DE GIROS V4.xlsx" (hoja CARGUE SUPERGIROS) a testigos_giros.
// Presencia en esta tabla = los viáticos ya fueron girados.
// Idempotente: upsert por cédula. Uso: npm run db:import:giros [-- /ruta/al.xlsx]
import xlsx from "xlsx";
import { createDbClient, upsertBatches, normalizarCedula, limpiarNombre } from "./db.mjs";

const RUTA = process.argv[2] ?? "/Users/testuser/Desktop/BD CARGUE DE GIROS V4.xlsx";
const HOJA = "CARGUE SUPERGIROS";
const COL_CEDULA = "No DE DOCUMENTO";

const libro = xlsx.readFile(RUTA);
const hoja = libro.Sheets[HOJA];
if (!hoja) {
  console.error(`✗ No existe la hoja "${HOJA}" en ${RUTA}`);
  process.exit(1);
}

// Encabezados reales en la fila 3 del Excel → range: 2
const filas = xlsx.utils.sheet_to_json(hoja, { range: 2, defval: "" });
if (filas.length === 0 || !(COL_CEDULA in filas[0])) {
  console.error(
    `✗ Estructura inesperada: no se encontró la columna "${COL_CEDULA}" en la fila 3. ` +
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
    fila["PRIMER NOMBRE"],
    fila["SEGUNDO NOMBRE"],
    fila["PRIMER APELLIDO"],
    fila["SEGUNDO APELLIDO"]
  );
  if (!porCedula.has(cedula)) porCedula.set(cedula, nombre || "SIN NOMBRE");
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
    "public.testigos_giros",
    ["cedula", "nombre"],
    rows,
    "nombre = EXCLUDED.nombre, updated_at = NOW()"
  );
  const { rows: total } = await client.query("SELECT count(*)::int AS n FROM testigos_giros");
  const { rows: muestra } = await client.query("SELECT cedula FROM testigos_giros LIMIT 3");
  console.log(`✓ testigos_giros: ${total[0].n} filas totales`);
  console.log(`  Cédulas de muestra (girado): ${muestra.map((r) => r.cedula).join(", ")}`);
} finally {
  await client.end();
}
