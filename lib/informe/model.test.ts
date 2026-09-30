import { describe, expect, it } from 'vitest'

import { COLOR, categoria, construeixInforme, deMes, mesIAny, nomFitxer, type FilaCrua, type InformeCru } from './model'

/** Una fila amb valors per defecte; els casos reals surten del PDF 209. */
function fila(parcial: Partial<FilaCrua> & Pick<FilaCrua, 'nom' | 'barruf'>): FilaCrua {
  return {
    numero: 1,
    club: null,
    ordre: 1,
    estat: 'act',
    posicio: 1,
    debutant: false,
    partides_totals: 100,
    victories_totals: 50,
    partides_temporada: 0,
    victories_temporada: 0,
    anterior: null,
    ...parcial,
  }
}

function informe(files: FilaCrua[]): InformeCru {
  return {
    edicio: {
      numero: 209,
      data_publicacio: '2026-09-18',
      temporada: '2025-26',
      campionats_computats: 'Lliga',
      resultats_acumulats: 49000,
      campionats_acumulats: 274,
    },
    anterior: 208,
    files,
    clubs: [],
  }
}

describe('una fila d’actiu', () => {
  // Xavier Albons al BARRUF 209: puja cinc llocs i 22 punts.
  const albons = fila({
    nom: 'Xavier Albons',
    club: 'MiMaM',
    barruf: 1235,
    posicio: 25,
    partides_totals: 473,
    victories_totals: 301.5,
    partides_temporada: 59,
    victories_temporada: 36.5,
    anterior: { barruf: 1213, estat: 'act', posicio: 30, partides_totals: 465, victories_totals: 294.5 },
  })
  const [f] = construeixInforme(informe([albons])).actius

  it('diu el mateix que el PDF', () => {
    expect(f.p).toBe('25')
    expect(f.var.text).toBe('+5')
    expect(f.categoria).toBe(3)
    expect(f.prg).toEqual({ text: '+22', color: COLOR.verd })
    expect(f.vb).toEqual({ text: '+7,0', color: COLOR.verd })
    expect(f.pjb).toBe('+8')
    expect(f.percentTemp).toEqual({ text: '62%', color: COLOR.verd })
    expect([f.vtemp, f.ptemp]).toEqual(['36,5', '59'])
    expect(f.percentTotal.text).toBe('64%')
    expect([f.vt.text, f.dt.text, f.pt]).toEqual(['301,5', '171,5', '473'])
  })

  it('baixar és vermell i quedar igual és un «=»', () => {
    const baixa = fila({ nom: 'x', barruf: 1229, posicio: 26, anterior: { barruf: 1229, estat: 'act', posicio: 25, partides_totals: 100, victories_totals: 50 } })
    const igual = fila({ nom: 'y', barruf: 1229, posicio: 25, anterior: { barruf: 1229, estat: 'act', posicio: 25, partides_totals: 100, victories_totals: 50 } })
    const [a, b] = construeixInforme(informe([baixa, { ...igual, ordre: 2 }])).actius
    expect(a.var).toEqual({ text: '-1', color: COLOR.vermell })
    expect(b.var.text).toBe('=')
    expect(a.prg).toEqual({ text: '0', color: undefined })
  })

  it('«deb» mana sobre tot, i «rec» és qui no tenia posició', () => {
    const deb = fila({ nom: 'Joan Pons', barruf: 1096, debutant: true })
    const rec = fila({ nom: 'Tornat', barruf: 1000, anterior: { barruf: 1000, estat: 'inact', posicio: null, partides_totals: 100, victories_totals: 50 } })
    const [a, b] = construeixInforme(informe([deb, rec])).actius
    expect(a.var.text).toBe('deb')
    expect(b.var.text).toBe('rec')
  })

  /**
   * Per sota del 10% el full no té regla i la cel·la pren el color de la
   * columna: al %T dels actius, verd. Immaculada Camprubí, 0 de 16, surt en verd.
   */
  it('reprodueix el 0% en verd del %T', () => {
    const [f] = construeixInforme(informe([fila({ nom: 'I', barruf: 811, partides_totals: 16, victories_totals: 0 })])).actius
    expect(f.percentTotal).toEqual({ text: '0%', color: COLOR.verd })
    expect(f.percentTemp).toEqual({ text: '0%', color: COLOR.negre })
    expect(f.dt.color).toBe(COLOR.vermell)
  })
})

describe('la llista d’espera', () => {
  it('porta l’estat on hi hauria la posició i els zeros en negre', () => {
    const cugat = fila({ nom: 'Albert Cugat', barruf: 1045, estat: 'inact', posicio: null, partides_totals: 3, victories_totals: 3 })
    const [f] = construeixInforme(informe([cugat])).espera
    expect(f.p).toBe('inact')
    expect(f.var.text).toBe('')
    expect(f.percentTotal).toEqual({ text: '100%', color: COLOR.verd })
    expect(f.dt).toEqual({ text: '0,0', color: undefined })
  })

  it('un jugador nou es compara amb el BARRUF de sortida', () => {
    const nou = fila({ nom: 'Xisca Bonet Riera', barruf: 839, estat: 'exp', posicio: null, partides_totals: 10, victories_totals: 1 })
    const [f] = construeixInforme(informe([nou])).espera
    expect(f.prg).toEqual({ text: '-111', color: COLOR.vermell })
    expect(f.vb).toEqual({ text: '+1,0', color: COLOR.verd })
    expect(f.pjb).toBe('+10')
  })

  it('deixa fora els novells', () => {
    const nov = fila({ nom: 'Nou', barruf: 950, estat: 'nov', posicio: null, partides_totals: 0, victories_totals: 0 })
    expect(construeixInforme(informe([nov])).espera).toEqual([])
  })
})

it('els empatats van en l’ordre de la llista del full, no per nom', () => {
  const pere = fila({ nom: 'Pere Grimalt Vert', barruf: 1268, posicio: 14, ordre: 9 })
  const andreu = fila({ nom: 'Andreu Fuster', barruf: 1268, posicio: 14, ordre: 5 })
  const noms = construeixInforme(informe([pere, andreu])).actius.map((f) => f.nom)
  expect(noms).toEqual(['Andreu Fuster', 'Pere Grimalt Vert'])
})

it('ordena la llegenda de clubs sense l’article', () => {
  const cru = informe([])
  cru.clubs = ['el Vendrell', 'Manacor', 'el Prat', "l'Hospitalet", 'Palma'].map((nom) => ({ nom, nom_llegenda: nom }))
  expect(construeixInforme(cru).clubs.map((c) => c.nom)).toEqual([
    "l'Hospitalet", 'Manacor', 'Palma', 'el Prat', 'el Vendrell',
  ])
})

it('categoria, mes i nom del fitxer', () => {
  expect([1423, 1387, 1235, 1190, 1045, 999.6, 999.4].map(categoria)).toEqual([1, 2, 3, 4, 5, 5, null])
  expect(mesIAny('2026-09-18')).toBe('setembre 2026')
  expect(nomFitxer({ numero: 210, mes: 'setembre 2026' })).toBe('BARRUF-210 setembre 2026.pdf')
})

it('apostrofa els mesos que comencen per vocal', () => {
  expect(deMes('setembre 2026')).toBe('de setembre 2026')
  expect(deMes('agost 2018')).toBe('d’agost 2018')
  expect(deMes('octubre 2019')).toBe('d’octubre 2019')
})
