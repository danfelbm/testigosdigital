-- ============================================================
-- 002_testigos_listado.sql — Listado de testigos registrados.
-- Idempotente. Mismo blindaje que 001: RLS sin políticas +
-- grants revocados (acceso solo server-side vía Postgres).
-- ============================================================

-- Registrado como testigo (fuente: testigos-listado CSV).
-- Presencia aquí sin evidencia ni giro = "sin evidencia enviada".
CREATE TABLE IF NOT EXISTS public.testigos_listado (
  cedula      TEXT PRIMARY KEY CHECK (cedula ~ '^[0-9]{4,11}$'),
  nombre      TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.testigos_listado ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.testigos_listado FROM anon, authenticated;

-- Nuevos resultados de consulta: sin_evidencia y no_registrada.
-- Se conserva 'no_encontrada' por compatibilidad con auditoría histórica.
ALTER TABLE public.testigos_consultas
  DROP CONSTRAINT IF EXISTS testigos_consultas_resultado_check;
ALTER TABLE public.testigos_consultas
  ADD CONSTRAINT testigos_consultas_resultado_check
  CHECK (resultado IN ('girado', 'en_proceso', 'no_encontrada', 'sin_evidencia', 'no_registrada'));
