import { afterEach, describe, expect, it } from 'vitest'

import { configuracioSupabase } from './configuracio'

const original = { ...process.env }
afterEach(() => {
  process.env = { ...original }
})

const posa = (url?: string, clau?: string) => {
  if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = url
  if (clau === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = clau
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
}

describe('configuracioSupabase', () => {
  it('llegeix la configuració bona', () => {
    posa('https://utbjfmlmvgewubxffakg.supabase.co', 'sb_publishable_exemple')
    expect(configuracioSupabase()).toEqual({
      url: 'https://utbjfmlmvgewubxffakg.supabase.co',
      clau: 'sb_publishable_exemple',
    })
  })

  it('diu quina variable falta i on es posa', () => {
    posa(undefined, 'clau')
    expect(() => configuracioSupabase()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
    expect(() => configuracioSupabase()).toThrow(/\.env\.local/)

    posa('https://x.supabase.co', undefined)
    expect(() => configuracioSupabase()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })

  it('accepta la clau amb el nom que posa la integració de Vercel', () => {
    posa('https://x.supabase.co', undefined)
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vercel'
    expect(configuracioSupabase().clau).toBe('sb_publishable_vercel')
  })

  it('no es deixa enganyar per una variable amb espais', () => {
    posa('   ', 'clau')
    expect(() => configuracioSupabase()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('avisa si encara hi ha el valor d’exemple', () => {
    posa('https://xxxxxxxx.supabase.co', 'clau')
    expect(() => configuracioSupabase()).toThrow(/valor d'exemple/)
  })

  it('exigeix una adreça i no un tros de text', () => {
    posa('utbjfmlmvgewubxffakg', 'clau')
    expect(() => configuracioSupabase()).toThrow(/ha de començar per https/)
  })

  /**
   * El que de debò val la pena enxampar: posar-hi la clau secreta faria que
   * s'enviés al navegador de tothom, i es salta totes les polítiques de l'RLS.
   */
  it('es planta si algú hi posa la clau secreta', () => {
    posa('https://x.supabase.co', 'sb_secret_aixo_no_hi_va')
    expect(() => configuracioSupabase()).toThrow(/clau SECRETA/)

    posa('https://x.supabase.co', 'eyJ...service_role...')
    expect(() => configuracioSupabase()).toThrow(/clau SECRETA/)
  })
})
