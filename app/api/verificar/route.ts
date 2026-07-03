import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { getPool } from "@/lib/db";
import { maskName } from "@/lib/mask";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MIN_RESPONSE_MS = 400;
const DAILY_LIMIT_PER_IP = 100;

type Estado = "girado" | "en_proceso" | "sin_evidencia" | "no_registrada";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function hashIp(ip: string): string {
  return createHash("sha256")
    .update(ip + (process.env.RATE_SALT ?? ""))
    .digest("hex");
}

export async function POST(request: Request) {
  let cedula: unknown;
  try {
    const body = await request.json();
    cedula = body?.cedula;
  } catch {
    return json({ success: false, error: "Cuerpo de la petición inválido" }, { status: 400 });
  }

  const limpia =
    typeof cedula === "string" ? cedula.replace(/\D/g, "").replace(/^0+/, "") : "";
  if (!/^\d{4,11}$/.test(limpia)) {
    return json(
      { success: false, error: "Cédula inválida. Ingresa solo números (4 a 11 dígitos)." },
      { status: 400 }
    );
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "desconocida")
    .split(",")[0]
    .trim();
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return json(
      { success: false, error: "Demasiadas consultas. Intenta de nuevo en un momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  // Tiempo mínimo uniforme para eliminar side-channels de timing entre estados.
  const [resultado] = await Promise.all([
    consultar(limpia, hashIp(ip), request.headers.get("user-agent") ?? ""),
    sleep(MIN_RESPONSE_MS),
  ]);

  if (resultado.tipo === "limite_diario") {
    return json(
      { success: false, error: "Se alcanzó el límite diario de consultas desde esta conexión." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }
  if (resultado.tipo === "error") {
    return json(
      { success: false, error: "Servicio no disponible en este momento. Intenta más tarde." },
      { status: 503 }
    );
  }

  return json({
    success: true,
    data: { estado: resultado.estado, nombre: resultado.nombre },
  });
}

async function consultar(
  cedula: string,
  ipHash: string,
  userAgent: string
): Promise<
  | { tipo: "ok"; estado: Estado; nombre: string | null }
  | { tipo: "limite_diario" }
  | { tipo: "error" }
> {
  try {
    const pool = getPool();

    const diario = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM testigos_consultas
       WHERE ip_hash = $1 AND created_at > now() - interval '1 day'`,
      [ipHash]
    );
    if (diario.rows[0].n >= DAILY_LIMIT_PER_IP) {
      return { tipo: "limite_diario" };
    }

    const [giro, evidencia, listado] = await Promise.all([
      pool.query<{ nombre: string }>(
        "SELECT nombre FROM testigos_giros WHERE cedula = $1",
        [cedula]
      ),
      pool.query<{ nombre: string }>(
        "SELECT nombre FROM testigos_evidencias WHERE cedula = $1",
        [cedula]
      ),
      pool.query<{ nombre: string }>(
        "SELECT nombre FROM testigos_listado WHERE cedula = $1",
        [cedula]
      ),
    ]);

    let estado: Estado;
    let nombre: string | null;
    if (giro.rows.length > 0) {
      estado = "girado";
      nombre = maskName(giro.rows[0].nombre);
    } else if (evidencia.rows.length > 0) {
      estado = "en_proceso";
      nombre = maskName(evidencia.rows[0].nombre);
    } else if (listado.rows.length > 0) {
      estado = "sin_evidencia";
      nombre = maskName(listado.rows[0].nombre);
    } else {
      estado = "no_registrada";
      nombre = null;
    }

    // Auditoría fire-and-forget: no bloquea la respuesta.
    pool
      .query(
        `INSERT INTO testigos_consultas (cedula, resultado, ip_hash, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [cedula, estado, ipHash, userAgent.slice(0, 300)]
      )
      .catch((err) => console.error("Error registrando consulta:", err.message));

    return { tipo: "ok", estado, nombre };
  } catch (err) {
    console.error("Error consultando estado:", err instanceof Error ? err.message : err);
    return { tipo: "error" };
  }
}
