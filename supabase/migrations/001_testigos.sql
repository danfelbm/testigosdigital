-- ============================================================
-- 001_testigos.sql — Testigos Digital. Idempotente.
-- Acceso EXCLUSIVO server-side vía conexión Postgres directa.
-- RLS sin políticas + grants revocados = bloqueo total de la
-- vía REST (anon / authenticated) como defensa en profundidad.
-- ============================================================

-- Viáticos ya girados (fuente: BD CARGUE DE GIROS V4.xlsx)
CREATE TABLE IF NOT EXISTS public.testigos_giros (
  cedula      TEXT PRIMARY KEY CHECK (cedula ~ '^[0-9]{4,11}$'),
  nombre      TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Validado para viáticos (fuente: evidencias CSV, agregado por cédula)
CREATE TABLE IF NOT EXISTS public.testigos_evidencias (
  cedula      TEXT PRIMARY KEY CHECK (cedula ~ '^[0-9]{4,11}$'),
  nombre      TEXT NOT NULL,
  num_mesas   INTEGER NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auditoría y rate-limit durable de consultas de la landing
CREATE TABLE IF NOT EXISTS public.testigos_consultas (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cedula      TEXT NOT NULL,
  resultado   TEXT NOT NULL
              CHECK (resultado IN ('girado', 'en_proceso', 'no_encontrada')),
  ip_hash     TEXT,           -- sha256(ip + RATE_SALT), nunca IP cruda
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testigos_consultas_ip_fecha
  ON public.testigos_consultas (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_testigos_consultas_created
  ON public.testigos_consultas (created_at);

-- Bloqueo total para clientes públicos (REST/PostgREST)
ALTER TABLE public.testigos_giros       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testigos_evidencias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testigos_consultas   ENABLE ROW LEVEL SECURITY;
-- Sin CREATE POLICY a propósito: nadie pasa salvo service_role/postgres,
-- que hacen bypass de RLS.

REVOKE ALL ON public.testigos_giros      FROM anon, authenticated;
REVOKE ALL ON public.testigos_evidencias FROM anon, authenticated;
REVOKE ALL ON public.testigos_consultas  FROM anon, authenticated;
