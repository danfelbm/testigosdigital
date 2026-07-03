// Verificación post-importación: conteos, intersección y cédulas de muestra
// por cada estado, listas para probar el API con curl.
import { createDbClient } from "./db.mjs";

const client = createDbClient();
await client.connect();
try {
  const q = async (sql, params) => (await client.query(sql, params)).rows;

  const [giros] = await q("SELECT count(*)::int AS n FROM testigos_giros");
  const [evidencias] = await q("SELECT count(*)::int AS n FROM testigos_evidencias");
  const [listado] = await q("SELECT count(*)::int AS n FROM testigos_listado");
  const [interseccion] = await q(
    `SELECT count(*)::int AS n FROM testigos_evidencias e
     JOIN testigos_giros g ON g.cedula = e.cedula`
  );
  const [consultas] = await q("SELECT count(*)::int AS n FROM testigos_consultas");

  console.log(`testigos_giros:       ${giros.n} (esperado ≈ 27.936)`);
  console.log(`testigos_evidencias:  ${evidencias.n} (esperado ≈ 24.871)`);
  console.log(`testigos_listado:     ${listado.n} (esperado ≈ 147.6xx)`);
  console.log(`giros ∩ evidencias:   ${interseccion.n}`);
  console.log(`testigos_consultas:   ${consultas.n}`);

  const girado = await q("SELECT cedula FROM testigos_giros LIMIT 1");
  const enProceso = await q(
    `SELECT e.cedula FROM testigos_evidencias e
     WHERE NOT EXISTS (SELECT 1 FROM testigos_giros g WHERE g.cedula = e.cedula)
     LIMIT 1`
  );
  const sinEvidencia = await q(
    `SELECT l.cedula FROM testigos_listado l
     WHERE NOT EXISTS (SELECT 1 FROM testigos_giros g WHERE g.cedula = l.cedula)
       AND NOT EXISTS (SELECT 1 FROM testigos_evidencias e WHERE e.cedula = l.cedula)
     LIMIT 1`
  );
  let noRegistrada = "9999999999";
  const existe = await q(
    `SELECT 1 FROM testigos_giros WHERE cedula = $1
     UNION SELECT 1 FROM testigos_evidencias WHERE cedula = $1
     UNION SELECT 1 FROM testigos_listado WHERE cedula = $1`,
    [noRegistrada]
  );
  if (existe.length > 0) noRegistrada = "9999999998";

  console.log("\nCédulas de muestra para pruebas:");
  console.log(`  girado:        ${girado[0]?.cedula ?? "(tabla vacía)"}`);
  console.log(`  en_proceso:    ${enProceso[0]?.cedula ?? "(ninguna)"}`);
  console.log(`  sin_evidencia: ${sinEvidencia[0]?.cedula ?? "(ninguna)"}`);
  console.log(`  no_registrada: ${noRegistrada}`);

  // Verificación de blindaje: RLS activo y sin políticas
  const rls = await q(
    `SELECT c.relname, c.relrowsecurity,
            (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS politicas
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname LIKE 'testigos_%' AND c.relkind = 'r'`
  );
  for (const t of rls) {
    const ok = t.relrowsecurity && t.politicas === 0;
    console.log(
      `${ok ? "✓" : "✗"} ${t.relname}: RLS=${t.relrowsecurity}, políticas=${t.politicas}`
    );
  }
} finally {
  await client.end();
}
