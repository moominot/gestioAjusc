/**
 * Distribució normal acumulada.
 *
 * El BARRUF fa servir la normal (com l'Elo original de la USCF) i no la
 * logística que utilitzen la FIDE o el Glicko. Aquí cal reproduir exactament el
 * que fa `NORMDIST(x; 0; σ; TRUE)` al full de càlcul.
 *
 * Implementació de Hart (1968), en la versió que en dona West (2005),
 * "Better approximations to cumulative normal functions". És exacta fins a la
 * precisió del doble (~1e-15), molt per damunt del que necessitem: un error de
 * 1e-7 per partida, multiplicat per 31 rondes i un factor K de 30, encara
 * quedaria per sota de la mil·lèsima de punt de BARRUF.
 */

/** Normal acumulada estàndard: P(Z ≤ z) amb Z ~ N(0,1). */
export function normalCDF(z: number): number {
  const abs = Math.abs(z)
  let p: number

  if (abs > 37) {
    p = 0
  } else {
    const exponencial = Math.exp((-abs * abs) / 2)

    if (abs < 7.07106781186547) {
      let num = 3.52624965998911e-2 * abs + 0.700383064443688
      num = num * abs + 6.37396220353165
      num = num * abs + 33.912866078383
      num = num * abs + 112.079291497871
      num = num * abs + 221.213596169931
      num = num * abs + 220.206867912376

      let den = 8.83883476483184e-2 * abs + 1.75566716318264
      den = den * abs + 16.064177579207
      den = den * abs + 86.7807322029461
      den = den * abs + 296.564248779674
      den = den * abs + 637.333633378831
      den = den * abs + 793.826512519948
      den = den * abs + 440.413735824752

      p = (exponencial * num) / den
    } else {
      // Fracció contínua per a la cua llunyana.
      let fraccio = abs + 0.65
      fraccio = abs + 4 / fraccio
      fraccio = abs + 3 / fraccio
      fraccio = abs + 2 / fraccio
      fraccio = abs + 1 / fraccio
      p = exponencial / (fraccio * 2.506628274631)
    }
  }

  return z > 0 ? 1 - p : p
}
