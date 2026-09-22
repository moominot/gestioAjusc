import { redirect } from 'next/navigation'

import { gestorConnectat } from '../../lib/supabase/servidor'

/**
 * Porta de la zona de gestió.
 *
 * És comoditat, no seguretat: qui mana de debò és l'RLS, que no deixa llegir ni
 * escriure res a qui no consti a `perfils` encara que arribi a la pàgina.
 */
export default async function DisposicioGestio({ children }: { children: React.ReactNode }) {
  const gestor = await gestorConnectat()
  if (!gestor) redirect('/entrar')

  return <div className="space-y-6">{children}</div>
}
