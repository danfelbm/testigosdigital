# Testigos Digital

Landing de consulta del estado de viáticos para testigos electorales: la persona
ingresa su número de cédula y la aplicación responde uno de cuatro estados, sin
exponer datos personales completos.

| Estado | Significado |
|---|---|
| `girado` | La cédula está en el cargue de giros → los viáticos ya fueron enviados a Supergiros. |
| `en_proceso` | La cédula está en las evidencias validadas pero aún no en el cargue de giros. |
| `sin_evidencia` | La cédula está en el listado de testigos registrados, pero no hay evidencia enviada en el sistema. |
| `no_registrada` | La cédula no aparece en ninguna fuente: no hay registro de que haya sido testigo. |

## Arquitectura y seguridad

- **Next.js 16** (App Router, TypeScript, Tailwind v4). Una página (`app/page.tsx`) y un API route (`app/api/verificar/route.ts`).
- **Los datos viven en Supabase pero se consultan por conexión Postgres directa** (`pg` + pooler en modo transacción, puerto 6543). No se usa supabase-js ni PostgREST: el cliente del navegador no recibe ninguna credencial (`NEXT_PUBLIC_*` no existe en este proyecto).
- Tablas con prefijo `testigos_` en el proyecto Supabase compartido, blindadas con **RLS habilitado sin políticas + `REVOKE ALL FROM anon, authenticated`**: aunque alguien tenga la anon key del proyecto, la vía REST no devuelve nada.
- El API responde **estado + nombre enmascarado** ("DARWIN G***"), con status 200 uniforme para los tres estados, `Cache-Control: no-store`, tiempo mínimo de respuesta uniforme (~400 ms) contra ataques de timing, rate limit de 10 consultas/minuto por IP en memoria y tope durable de 100/día por IP contra `testigos_consultas` (las IPs se guardan hasheadas con salt, nunca crudas).

## Configuración

```bash
cp .env.example .env.local   # y completa los valores
npm install
```

Variables (ver `.env.example`): `SUPABASE_DB_URL` (connection string del pooler
de Supabase; la app usa el puerto 6543 y los scripts cambian solos al 5432),
`RATE_SALT` (aleatorio) y `SUPABASE_URL` (opcional, solo diagnóstico).

## Base de datos

```bash
npm run db:setup   # check + migrate + import giros + import evidencias + verify
```

O paso a paso: `db:check`, `db:migrate`, `db:import:giros [-- ruta.xlsx]`,
`db:import:evidencias [-- ruta.csv]`, `db:import:listado [-- ruta.csv]`, `db:verify`.

Fuentes de datos originales (no incluidas en el repo):

- `BD CARGUE DE GIROS V4.xlsx`, hoja `CARGUE SUPERGIROS` (encabezados en la fila 3, cédula en `No DE DOCUMENTO`) → `testigos_giros`.
- `evidencias-consolidado-*.csv` (UTF-8 BOM; un testigo puede aparecer en varias mesas) → se agrega por cédula en `testigos_evidencias` (solo cédula, nombre y número de mesas; teléfonos, correos y datos electorales **no** se cargan, por minimización de datos).
- `testigos-listado-*.csv` (UTF-8 BOM; registro de testigos, cédula en `Documento`) → `testigos_listado` (solo cédula y nombre; emails, teléfonos, fechas de nacimiento y demás columnas **no** se cargan).

Los imports son idempotentes (upsert por cédula): re-ejecutarlos con archivos
actualizados refresca los datos sin duplicar.

## Desarrollo

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

Prueba rápida del API:

```bash
curl -s -X POST localhost:3000/api/verificar \
  -H 'Content-Type: application/json' -d '{"cedula":"1234567"}'
```
