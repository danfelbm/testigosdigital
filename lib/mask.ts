// Enmascara un nombre para confirmar identidad sin exponer el dato completo:
// "DARWIN ANDRES GONZALEZ PEREZ" → "DARWIN G***" (primera palabra + inicial
// del primer apellido). Con dos palabras: "DARWIN GONZALEZ" → "DARWIN G***".
export function maskName(nombre: string): string {
  const palabras = nombre.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "***";
  if (palabras.length === 1) return `${palabras[0][0]}***`;
  // Con 3+ palabras el apellido suele empezar en la penúltima posición par;
  // usamos la segunda mitad para no revelar el segundo nombre completo.
  const apellido = palabras.length >= 3 ? palabras[Math.floor(palabras.length / 2)] : palabras[1];
  return `${palabras[0]} ${apellido[0]}***`;
}
