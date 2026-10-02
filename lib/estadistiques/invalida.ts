import { revalidatePath, updateTag } from 'next/cache'

/**
 * Les estadístiques es guarden una estona (vegeu `cau.ts`). Qualsevol acció
 * que en canviï les dades (un campionat, una partida, un jugador, una
 * publicació) ha de cridar això perquè la propera visita ja les vegi noves.
 * Només es pot cridar des d'una acció de servidor.
 */
export function invalidaEstadistiques() {
  updateTag('estadistiques')
  revalidatePath('/estadistiques', 'layout')
}
