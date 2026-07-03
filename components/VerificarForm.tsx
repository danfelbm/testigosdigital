"use client";

import { useState } from "react";

type Estado = "girado" | "en_proceso" | "sin_evidencia" | "no_registrada";

interface Resultado {
  estado: Estado;
  nombre: string | null;
}

const ESTILOS: Record<Estado, string> = {
  girado: "border-emerald-300 bg-emerald-50 text-emerald-900",
  en_proceso: "border-amber-300 bg-amber-50 text-amber-900",
  sin_evidencia: "border-orange-300 bg-orange-50 text-orange-900",
  no_registrada: "border-slate-300 bg-slate-100 text-slate-700",
};

const TITULOS: Record<Estado, string> = {
  girado: "Viáticos girados",
  en_proceso: "Validada — viáticos en proceso",
  sin_evidencia: "Sin evidencia en el sistema",
  no_registrada: "Sin registro de testigo",
};

function descripcion(resultado: Resultado): string {
  switch (resultado.estado) {
    case "girado":
      return `El giro de tus viáticos ya fue enviado a nombre de ${resultado.nombre ?? "la persona registrada"}. Puedes reclamarlo en cualquier punto Supergiros presentando tu cédula.`;
    case "en_proceso":
      return `Tu evidencia fue validada a nombre de ${resultado.nombre ?? "la persona registrada"}. Tus viáticos están en proceso de giro; consulta de nuevo en unos días.`;
    case "sin_evidencia":
      return `Estás en el listado de testigos a nombre de ${resultado.nombre ?? "la persona registrada"}, pero no hay evidencia enviada en el sistema. Si enviaste tu acta, comunícate con tu coordinación.`;
    case "no_registrada":
      return "No hay registro de que hayas sido testigo electoral en este proceso. Verifica que el número de cédula esté bien escrito.";
  }
}

export function VerificarForm() {
  const [cedula, setCedula] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cargando || cedula.length < 4) return;
    setCargando(true);
    setResultado(null);
    setError(null);
    try {
      const res = await fetch("/api/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula }),
      });
      const body = await res.json();
      if (body.success) {
        setResultado(body.data as Resultado);
      } else {
        setError(body.error ?? "No se pudo realizar la consulta.");
      }
    } catch {
      setError("Error de conexión. Verifica tu internet e intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="cedula" className="block text-sm font-medium text-slate-700">
          Número de cédula
        </label>
        <input
          id="cedula"
          name="cedula"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={11}
          placeholder="Ej. 1012345678"
          value={cedula}
          onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
          className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-lg tracking-wide outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
        <button
          type="submit"
          disabled={cargando || cedula.length < 4}
          className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cargando ? "Consultando…" : "Consultar"}
        </button>
      </form>

      <div role="status" aria-live="polite" className="mt-4 empty:hidden">
        {resultado && (
          <div className={`rounded-lg border p-4 ${ESTILOS[resultado.estado]}`}>
            <p className="font-semibold">{TITULOS[resultado.estado]}</p>
            <p className="mt-1 text-sm leading-relaxed">{descripcion(resultado)}</p>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    </section>
  );
}
