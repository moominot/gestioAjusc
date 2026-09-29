/** @type {import('next').NextConfig} */
const nextConfig = {
  // Res d'`output: 'export'`. L'aplicació necessita servidor: autenticació,
  // pàgines públiques renderitzades al servidor i accions de gestió.
  reactStrictMode: true,

  // Les fonts i el logo del PDF es llegeixen del disc en temps d'execució, i
  // Vercel només s'emporta els fitxers que veu importats si no se li diu.
  outputFileTracingIncludes: {
    '/barruf/pdf': ['./lib/informe/recursos/**/*'],
  },
}

module.exports = nextConfig
