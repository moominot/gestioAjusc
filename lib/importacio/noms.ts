/**
 * Normalització de noms de jugador.
 *
 * És la peça de la qual depèn tota la resolució d'identitats: els resultats
 * arriben de campionats que l'AJUSC no organitza, amb els noms escrits com cada
 * organitzador els escriu. Aquesta funció ha de donar la mateixa forma canònica
 * per a totes les variants que de fet són la mateixa persona.
 *
 * Tant el generador de la llavor (`scripts/genera_llavor.py`) com l'aplicació
 * fan servir aquestes regles. Si en canvieu cap, cal regenerar els àlies.
 */

/**
 * Treu del nom el que no s'hi veu però hi és.
 *
 * Cal perquè les dades d'origen en porten: a la llista del BARRUF hi ha un
 * jugador amb un WORD JOINER (U+2060) al davant del nom i uns quants amb espai
 * al començament. Sense netejar-ho, la coincidència exacta hi falla sempre i la
 * mateixa persona demana validació manual a cada importació.
 *
 * `\p{Cf}` són els caràcters de format invisibles (WORD JOINER, espais
 * d'amplada zero, marques de direcció, BOM) i `\p{Zs}` els separadors que no
 * són l'espai normal (no separable, fi, estret, ideogràfic).
 */
export function netejaNom(nom: string): string {
  return nom
    .replace(/\p{Cf}/gu, '')
    .replace(/\p{Zs}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Forma canònica per comparar dos noms: sense accents, sense punt volat i en
 * minúscules.
 *
 * El punt volat es descarta perquè 'Paral·lel' i 'Parallel' són el mateix nom
 * escrit amb més o menys cura, i els apòstrofs tipogràfics s'unifiquen amb el
 * recte pel mateix motiu.
 */
export function normalitzaNom(nom: string): string {
  return netejaNom(nom)
    .replace(/·/g, '')
    .replace(/[‘’]/g, "'")
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
}
