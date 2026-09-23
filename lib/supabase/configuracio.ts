/**
 * Lectura de la configuració de Supabase.
 *
 * Existeix per una raó pràctica: si falta una variable, el client de Supabase
 * peta amb un «supabaseUrl is required» que no diu ni quina variable falta ni
 * on es posa. La primera vegada que s'arrenca això et fa perdre una estona.
 */

export interface ConfiguracioSupabase {
  url: string
  clau: string
}

const ON_ES_POSA =
  'Copieu .env.example a .env.local i ompliu-lo amb les dades del projecte ' +
  '(Project Settings → API Keys). Vegeu docs/desplegament.md.'

function exigeix(nom: string, valor: string | undefined, descripcio: string): string {
  const net = (valor ?? '').trim()
  if (net === '') {
    throw new Error(`Falta la variable ${nom} (${descripcio}).\n${ON_ES_POSA}`)
  }
  return net
}

/** Llegeix i valida la configuració. Peta amb un missatge útil si no hi és. */
export function configuracioSupabase(): ConfiguracioSupabase {
  const url = exigeix(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "l'adreça del projecte, https://<referència>.supabase.co",
  )

  // La integració de Vercel amb Supabase posa totes dues; a mà n'hi ha prou
  // amb una. Cal escriure-les senceres: Next.js només incrusta al navegador les
  // NEXT_PUBLIC_ que apareixen literalment al codi.
  const clau = exigeix(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    'la clau publicable, la que va al navegador; també val ' +
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  )

  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL ha de començar per https://, i hi ha «${url}».\n${ON_ES_POSA}`,
    )
  }

  // Els valors d'exemple donen un error molt més confús més endavant.
  if (url.includes('xxxxxxxx')) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL encara té el valor d'exemple.\n${ON_ES_POSA}`,
    )
  }

  // La clau secreta no ha de sortir mai del servidor, i aquesta aplicació no la
  // fa servir enlloc. Si algú la posa aquí, acabaria al navegador.
  if (clau.startsWith('sb_secret_') || clau.includes('service_role')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY sembla la clau SECRETA. Aquesta clau es salta ' +
        "totes les polítiques de seguretat i aquí acabaria al navegador de tothom. " +
        'Poseu-hi la clau publicable (sb_publishable_… o la anon).',
    )
  }

  return { url, clau }
}
