import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Testigos Digital — Consulta el estado de tu pago",
  description:
    "Verifica con tu número de cédula si tu pago como testigo electoral ya fue girado.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
