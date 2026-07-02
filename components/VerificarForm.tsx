"use client";

import { useState } from "react";

type Estado = "girado" | "en_proceso" | "no_encontrada";

interface Resultado {
  estado: Estado;
  nombre: string | null;
}

const ESTILOS: Record<Estado, string> = {
  girado: "border-emerald-300 bg-emerald-50 text-emerald-900",
  en_proceso: "border-amber-300 bg-amber-50 text-amber-900",
  no_encontrada: "border-slate-300 bg-slate-100 text-slate-700",
};

const TITULOS: Record<Estado, string> = {
  girado: "Pago girado",
  en_proceso: "Validada — pago en proceso",
  no_encontrada: "Cédula no encontrada",
};

function descripcion(resultado: Resultado): string {
  switch (resultado.estado) {
    case "girado":
      return `El giro ya fue enviado a nombre de ${resultado.nombre ?? "la persona registrada"}. Puedes reclamarlo en cualquier punto Supergiros presentando tu cédula.`;
    case "en_proceso":
      return `Tu evidencia fue validada a nombre de ${resultado.nombre ?? "la persona registrada"}. El pago está en proceso de giro; consulta de nuevo en unos días.`;
    case "no_encontrada":
      return "Tu cédula no aparece en la base de pagos ni en las evidencias validadas. Si fuiste testigo electoral y cargaste tu evidencia, contacta a tu coordinación.";
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
