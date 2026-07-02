import { VerificarForm } from "@/components/VerificarForm";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">
          Testigos Digital
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Consulta el estado de tus viáticos
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Ingresa tu número de cédula para verificar si tus viáticos como
          testigo electoral ya fueron girados o están en proceso.
        </p>
      </header>

      <VerificarForm />

      <footer className="mt-10 text-center text-xs text-slate-400">
        Esta consulta no muestra datos personales completos. Si crees que hay
        un error con tu registro, comunícate con tu coordinación departamental.
      </footer>
    </main>
  );
}
