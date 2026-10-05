/**
 * La configuració de Supabase pot arribar amb noms diferents: els nostres
 * (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) o els que posa la
 * integració de Supabase a Vercel (SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 * SUPABASE_ANON_KEY...). Es queda el primer que tingui valor de debò: una
 * variable creada buida, o amb el text d'exemple, no ha de tapar les bones.
 */
const primerAmbValor = (...noms) =>
  noms
    .map((nom) => (process.env[nom] ?? '').trim())
    .find((valor) => valor !== '' && !valor.includes('xxxxxxxx'))

const supabase = {
  BARRUF_SUPABASE_URL: primerAmbValor('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
  BARRUF_SUPABASE_CLAU: primerAmbValor(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
  ),
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Res d'`output: 'export'`. L'aplicació necessita servidor: autenticació,
  // pàgines públiques renderitzades al servidor i accions de gestió.
  reactStrictMode: true,

  // Els fitxers que es pugen a l'importador passen per accions del servidor, que
  // per defecte no admeten més d'1 MB. Vercel en talla qualsevol de més de 4,5 MB.
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },

  // S'incrusten en compilar, al servidor i al navegador (vegeu a dalt).
  env: Object.fromEntries(Object.entries(supabase).filter(([, valor]) => valor !== undefined)),

  // Les fonts i el logo del PDF, i la plantilla de la imatge per a les xarxes,
  // es llegeixen del disc en temps d'execució, i Vercel només s'emporta els
  // fitxers que veu importats si no se li diu.
  outputFileTracingIncludes: {
    '/barruf/pdf': ['./lib/informe/recursos/**/*'],
    '/barruf/imatge': ['./lib/xarxes/recursos/**/*'],
  },
}

module.exports = nextConfig
