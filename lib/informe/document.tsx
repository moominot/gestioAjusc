/**
 * El PDF del BARRUF, amb el format que publica l'AJUSC.
 *
 * La paginació es fa a mà i no deixant que la llibreria talli: així cada pàgina
 * porta sempre el mateix nombre de files que el PDF de sempre (34 a la primera,
 * 48 a les altres; 45 a la primera de la llista d'espera), i dues edicions es
 * poden comparar pàgina per pàgina.
 */

import path from 'node:path'
import type { ComponentProps, ReactElement } from 'react'

import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
  type DocumentProps,
} from '@react-pdf/renderer'

import type { Destacats, JugadorDestacat } from './destacats'
import { COLOR, deMes, type Cella, type Fila, type Informe } from './model'

const RECURSOS = path.join(process.cwd(), 'lib/informe/recursos')

// Carlito té les mateixes mètriques que Calibri, la lletra del full, i Caladea
// és la del títol. Totes dues són lliures (OFL).
Font.register({
  family: 'Carlito',
  fonts: [
    { src: path.join(RECURSOS, 'Carlito-Regular.ttf') },
    { src: path.join(RECURSOS, 'Carlito-Bold.ttf'), fontWeight: 'bold' },
  ],
})
Font.register({ family: 'Caladea', src: path.join(RECURSOS, 'Caladea-Bold.ttf'), fontWeight: 'bold' })
// Cap nom s'ha de partir amb guionet.
Font.registerHyphenationCallback((paraula) => [paraula])

const LILA = '#666699'
/** L'especial de temporada (i les comparatives) va en verd, com el publica l'AJUSC. */
const VERD = '#274E13'
/** El color de fons de bandes i capçaleres: lila a les edicions, verd a l'especial. */
const fons = (especial: boolean) => (especial ? VERD : LILA)
const ZEBRA = '#E8E7FC'

const FILES_PRIMERA = 34
const FILES_PAGINA = 48
const FILES_PRIMERA_ESPERA = 45
/** Si a l'última pàgina d'actius n'hi ha més, la llegenda de clubs va a part. */
const FILES_AMB_LLEGENDA = 36

const ALT_FILA = 15.3

/** Amplades de les columnes, en punts. Sumen l'amplada de la taula, 549. */
const W = {
  p: 19, var: 22, cat: 19, club: 38, nom: 116, barruf: 36,
  prg: 28, vb: 32, pjb: 27,
  pctTemp: 28, vtemp: 29, ptemp: 30,
  pctT: 30, vt: 32, dt: 29, pt: 28,
  separacio: 2,
}

/** A l'especial de temporada no hi ha VB ni PjB: aquell espai va al nom. */
const amplades = (especial: boolean) =>
  especial ? { ...W, nom: W.nom + W.vb + W.pjb, vb: 0, pjb: 0 } : W

const s = StyleSheet.create({
  pagina: { paddingTop: 23, paddingHorizontal: 23, paddingBottom: 30, fontFamily: 'Carlito', fontSize: 10 },
  numPagina: { position: 'absolute', bottom: 16, right: 23, fontSize: 10 },

  banda: {
    backgroundColor: LILA, color: 'white', alignItems: 'center',
    paddingVertical: 5, borderWidth: 0.8, borderColor: '#333',
  },
  titol: { fontFamily: 'Caladea', fontWeight: 'bold', fontSize: 16, marginBottom: 3 },
  liniaBanda: { fontSize: 9.5, lineHeight: 1.45 },
  logo: { position: 'absolute', left: 6, top: 4, width: 64, height: 64 },
  totals: { textAlign: 'center', fontSize: 10, paddingVertical: 2, borderBottomWidth: 0.8, borderColor: '#333' },

  llegenda: { flexDirection: 'row', marginTop: 18, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 0.8, borderColor: '#333' },
  columnaLlegenda: { flexDirection: 'column' },
  elementLlegenda: { flexDirection: 'row', alignItems: 'center', height: 15 },
  etiqueta: {
    backgroundColor: LILA, color: 'white', fontWeight: 'bold', fontSize: 7,
    textAlign: 'center', paddingVertical: 2.5, marginRight: 4,
  },
  descripcio: { fontSize: 7 },

  capGrup: { flexDirection: 'row', height: 15 },
  capColumnes: { flexDirection: 'row', height: 15, backgroundColor: LILA },
  textCap: { color: 'white', fontWeight: 'bold', fontSize: 8, textAlign: 'center' },

  fila: { flexDirection: 'row', height: ALT_FILA, alignItems: 'center' },
  cella: { textAlign: 'center' },
  dreta: { textAlign: 'right', paddingRight: 3 },
  club: { fontSize: 6.5, textAlign: 'center' },
  nom: { fontWeight: 'bold', paddingLeft: 2 },
  negreta: { fontWeight: 'bold' },

  bandaEspera: {
    backgroundColor: LILA, color: 'white', alignItems: 'center',
    paddingVertical: 6, marginBottom: 12, borderWidth: 0.8, borderColor: '#333',
  },
  titolEspera: { fontFamily: 'Caladea', fontWeight: 'bold', fontSize: 13, marginBottom: 3 },
  liniaEspera: { fontSize: 8, fontWeight: 'bold', lineHeight: 1.4 },

  llegendaClubs: { flexDirection: 'row', marginTop: 16 },
  columnaClubs: { width: 183 },
})

const CATEGORIES = ['Gran Gran Mestre', 'Gran Mestre', 'Mestre', 'Expert', 'Avançat']

/** ❶ a ❺: un cercle del color de la categoria amb el número en blanc. */
function Categoria({ n, mida = 8.5 }: { n: number | null; mida?: number }) {
  if (n === null) return null
  return (
    <View
      style={{
        width: mida, height: mida, borderRadius: mida / 2,
        backgroundColor: COLOR.categoria[n - 1], alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ color: 'white', fontSize: mida * 0.78, fontWeight: 'bold', lineHeight: 1 }}>{n}</Text>
    </View>
  )
}

type Estil = Extract<ComponentProps<typeof Text>['style'], { textAlign?: unknown }>

function T({ c, w, estil }: { c: Cella | string; w: number; estil?: Estil }) {
  const cella = typeof c === 'string' ? { text: c } : c
  return (
    <Text style={[{ width: w }, s.cella, estil ?? {}, cella.color ? { color: cella.color } : {}]}>
      {cella.text}
    </Text>
  )
}

function Separacio() {
  return <View style={{ width: W.separacio }} />
}

// --- Capçalera de la taula ------------------------------------------------------

function CapTaula({
  numero,
  temporada,
  espera,
  especial = false,
}: {
  numero: number
  temporada: string
  espera: boolean
  especial?: boolean
}) {
  const W = amplades(especial)
  const grup = (text: string, amplada: number) => (
    <View style={{ width: amplada, backgroundColor: fons(especial), justifyContent: 'center' }}>
      <Text style={s.textCap}>{text}</Text>
    </View>
  )
  const esquerra = W.p + W.var + W.cat + W.club + W.nom + W.barruf
  const col = (text: string, amplada: number) => (
    <Text style={[s.textCap, { width: amplada, paddingTop: 3 }]}>{text}</Text>
  )
  const blanc = <View style={{ width: W.separacio, backgroundColor: 'white' }} />

  return (
    <View>
      <View style={s.capGrup}>
        <View style={{ width: esquerra }} />
        {blanc}
        {especial ? (
          grup(`Temp. ${temporada}`, W.prg + W.pctTemp + W.vtemp + W.ptemp + W.separacio)
        ) : (
          <>
            {grup(`BARRUF ${numero}`, W.prg + W.vb + W.pjb)}
            {blanc}
            {grup(`Temp. ${temporada}`, W.pctTemp + W.vtemp + W.ptemp)}
          </>
        )}
        {blanc}
        {grup('Total històric', W.pctT + W.vt + W.dt + W.pt)}
      </View>
      <View style={[s.capColumnes, { marginTop: 1.5, backgroundColor: fons(especial) }]}>
        {espera ? col('p', W.p + W.var) : <>{col('p', W.p)}{col('var', W.var)}</>}
        {col('cat', W.cat)}
        {col('club', W.club)}
        {col('Jugador/a', W.nom)}
        {col('BARRUF', W.barruf)}
        {blanc}
        {col('prg', W.prg)}
        {especial ? null : col('VB', W.vb)}
        {especial ? null : col('PjB', W.pjb)}
        {blanc}
        {col('%temp', W.pctTemp)}
        {col('Vtemp', W.vtemp)}
        {col('Ptemp', W.ptemp)}
        {blanc}
        {col('%T', W.pctT)}
        {col('VT', W.vt)}
        {col('DT', W.dt)}
        {col('PT', W.pt)}
      </View>
    </View>
  )
}

function FilaTaula({
  f,
  index,
  espera,
  especial = false,
}: {
  f: Fila
  index: number
  espera: boolean
  especial?: boolean
}) {
  const W = amplades(especial)
  return (
    <View style={[s.fila, index % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
      {espera ? (
        <T c={f.p} w={W.p + W.var} />
      ) : (
        <>
          <T c={f.p} w={W.p} estil={{ textAlign: 'right' }} />
          <T c={f.var} w={W.var} />
        </>
      )}
      <View style={{ width: W.cat, alignItems: 'center' }}>
        <Categoria n={f.categoria} />
      </View>
      <Text style={[s.club, { width: W.club }]}>{f.club}</Text>
      {/* Un nom massa llarg es talla, com al full, en comptes d'ocupar dues línies. */}
      <View style={{ width: W.nom, height: ALT_FILA, justifyContent: 'center', overflow: 'hidden' }}>
        <Text style={[s.nom, { width: 400 }]}>{f.nom}</Text>
      </View>
      <T c={f.barruf} w={W.barruf} estil={{ ...s.dreta, ...s.negreta }} />
      <Separacio />
      <T c={f.prg} w={W.prg} />
      {especial ? null : <T c={f.vb} w={W.vb} />}
      {especial ? null : <T c={f.pjb} w={W.pjb} />}
      <Separacio />
      <T c={f.percentTemp} w={W.pctTemp} estil={s.dreta} />
      <T c={f.vtemp} w={W.vtemp} estil={s.dreta} />
      <T c={f.ptemp} w={W.ptemp} estil={s.dreta} />
      <Separacio />
      <T c={f.percentTotal} w={W.pctT} estil={s.dreta} />
      <T c={f.vt} w={W.vt} estil={s.dreta} />
      <T c={f.dt} w={W.dt} estil={s.dreta} />
      <T c={f.pt} w={W.pt} estil={s.dreta} />
    </View>
  )
}

// --- Blocs de la primera pàgina -----------------------------------------------

function Capcalera({ informe }: { informe: Informe }) {
  return (
    <View>
      <View style={[s.banda, { backgroundColor: fons(informe.especial !== null) }]}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image style={s.logo} src={path.join(RECURSOS, 'logo-ajusc.png')} />
        <Text style={s.titol}>BARRUF</Text>
        <Text style={s.liniaBanda}>
          El BARRUF és el rànquing de jugadors de Scrabble clàssic elaborat per l’AJUSC.
        </Text>
        {informe.especial ? (
          <>
            <Text style={[s.liniaBanda, { fontSize: 11 }]}>
              {informe.especial.temporada
                ? `Edició especial de final de temporada ${informe.temporada}`
                : `Comparativa de dues edicions, temporada ${informe.temporada}`}
            </Text>
            <Text style={s.liniaBanda}>
              Comparativa entre el BARRUF {informe.especial.anterior} i el BARRUF {informe.numero}
            </Text>
          </>
        ) : (
          <Text style={s.liniaBanda}>
            Temporada {informe.temporada} | Edició número {informe.numero}, {deMes(informe.mes)}
          </Text>
        )}
        {informe.campionatsComputats && !informe.especial ? (
          <Text style={s.liniaBanda}>Campionat computat: {informe.campionatsComputats}</Text>
        ) : null}
      </View>
      {informe.resultatsAcumulats !== null && informe.campionatsAcumulats !== null ? (
        <Text style={s.totals}>
          Des de l&apos;any 2000: {informe.resultatsAcumulats} resultats individuals anotats i{' '}
          {informe.campionatsAcumulats} campionats o fases computats.
        </Text>
      ) : null}
    </View>
  )
}

function Llegenda({ especial = false }: { especial?: boolean }) {
  const element = (etiqueta: string | null, amplada: number, descripcio: React.ReactNode) => (
    <View style={s.elementLlegenda} key={etiqueta ?? 'cat2'}>
      {etiqueta ? (
        <Text style={[s.etiqueta, { width: amplada, backgroundColor: fons(especial) }]}>{etiqueta}</Text>
      ) : (
        <View style={{ width: amplada + 4 }} />
      )}
      {typeof descripcio === 'string' ? <Text style={s.descripcio}>{descripcio}</Text> : descripcio}
    </View>
  )
  const categoria = (n: number) => (
    <View key={n} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Categoria n={n} mida={7} />
      <Text style={s.descripcio}> {CATEGORIES[n - 1]}</Text>
      {n !== 2 && n !== 5 ? <Text style={s.descripcio}> | </Text> : null}
    </View>
  )

  return (
    <View style={s.llegenda}>
      <View style={[s.columnaLlegenda, { width: 212 }]}>
        {element('p', 18, 'Posició')}
        {element('var', 18, especial ? 'Variació de posició respecte l’anterior temporada' : 'Variació de posició respecte l\'anterior BARRUF')}
        {element('deb', 18, especial ? 'Debutant a la temporada' : 'Debutant a la temporada en curs')}
        {element('rec', 18, 'Jugador recuperat, que torna a ser actiu')}
        {element('cat', 18, (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={s.descripcio}>Categoria: </Text>
            {[1, 2].map(categoria)}
          </View>
        ))}
        {element(null, 18, (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>{[3, 4, 5].map(categoria)}</View>
        ))}
      </View>
      <View style={[s.columnaLlegenda, { width: 222 }]}>
        {element('prg', 40, especial ? 'Progressió respecte de l’anterior temporada' : 'Progressió respecte l’anterior BARRUF')}
        {especial ? null : element('VB', 40, 'Victòries des de l’anterior BARRUF')}
        {especial ? null : element('PjB', 40, 'Partides jugades des de l’anterior BARRUF')}
        {element('%temp', 40, especial ? '% de victòries de la temporada' : '% de victòries de la temporada en curs')}
        {element('Vtemp', 40, especial ? 'Victòries de la temporada' : 'Victòries de la temporada en curs')}
        {element('Ptemp', 40, especial ? 'Partides jugades a la temporada' : 'Partides jugades la temporada en curs')}
      </View>
      <View style={s.columnaLlegenda}>
        {element('%T', 30, '% total de victòries')}
        {element('VT', 30, 'Victòries en total')}
        {element('DT', 30, 'Derrotes en total')}
        {element('PT', 30, 'Partides jugades en total')}
      </View>
    </View>
  )
}

function LlegendaClubs({ clubs }: { clubs: Informe['clubs'] }) {
  const perColumna = Math.ceil(clubs.length / 3)
  const columnes = [0, 1, 2].map((i) => clubs.slice(i * perColumna, (i + 1) * perColumna))
  return (
    <View style={s.llegendaClubs}>
      {columnes.map((columna, i) => (
        <View key={i} style={s.columnaClubs}>
          {columna.map((c) => (
            <View key={c.nom} style={[s.elementLlegenda, { height: 14 }]}>
              <Text style={[s.etiqueta, { width: 42, fontWeight: 'normal' }]}>{c.nom}</Text>
              <Text style={s.descripcio}>{c.nomLlegenda}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

// --- Destacats -------------------------------------------------------------------

const sd = StyleSheet.create({
  xifres: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  xifra: { width: 86, alignItems: 'center', borderWidth: 0.8, borderColor: VERD, paddingVertical: 5 },
  numero: { fontSize: 16, fontWeight: 'bold' },
  etiquetaXifra: { fontSize: 7.5, textAlign: 'center' },
  columnes: { flexDirection: 'row', justifyContent: 'space-between' },
  columna: { width: 268 },
  bloc: { marginBottom: 12 },
  titolBloc: { backgroundColor: VERD, color: 'white', fontWeight: 'bold', fontSize: 9, paddingVertical: 2.5, paddingHorizontal: 5 },
  linia: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5, paddingVertical: 1.8, fontSize: 9 },
})

function Bloc({ titol, jugadors, buit = 'Cap' }: { titol: string; jugadors: JugadorDestacat[]; buit?: string }) {
  return (
    <View style={sd.bloc} wrap={false}>
      <Text style={sd.titolBloc}>{titol}</Text>
      {jugadors.length === 0 ? (
        <Text style={sd.linia}>{buit}</Text>
      ) : (
        jugadors.map((j, i) => (
          <View key={j.numero} style={[sd.linia, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
            <Text style={{ fontWeight: 'bold' }}>
              {j.nom}
              {j.club ? <Text style={{ fontWeight: 'normal', fontSize: 7.5 }}>  {j.club}</Text> : null}
            </Text>
            <Text>{j.valor}</Text>
          </View>
        ))
      )}
    </View>
  )
}

const CATEGORIA_NOM = ['Gran Gran Mestre', 'Gran Mestre', 'Mestre', 'Expert', 'Avançat']

function PaginaDestacats({ d }: { d: Destacats }) {
  const xifres: [string, number | null][] = [
    ['jugadors actius', d.xifres.actius],
    ['han jugat aquesta temporada', d.xifres.ambPartides],
    ['partides jugades', d.xifres.partides],
    ['campionats barrufats', d.xifres.campionats],
    ['debutants', d.xifres.debutants],
    ['recuperats', d.xifres.recuperats],
  ]
  return (
    <View>
      <View style={[s.bandaEspera, { backgroundColor: VERD }]}>
        <Text style={s.titolEspera}>Destacats de la temporada {d.temporada}</Text>
        <Text style={s.liniaEspera}>Comparativa entre el BARRUF {d.anterior} i el BARRUF {d.numero}</Text>
      </View>
      <View style={sd.xifres}>
        {xifres.filter(([, v]) => v !== null).map(([etiqueta, valor]) => (
          <View key={etiqueta} style={sd.xifra}>
            <Text style={sd.numero}>{valor}</Text>
            <Text style={sd.etiquetaXifra}>{etiqueta}</Text>
          </View>
        ))}
      </View>
      <View style={sd.columnes}>
        <View style={sd.columna}>
          <Bloc titol="El podi" jugadors={d.podi.ara.map((j, i) => ({ ...j, valor: `${i + 1}r · ${j.valor}` }))} />
          <Bloc titol="Qui més ha pujat" jugadors={d.mesPujada} />
          <Bloc titol="Qui més posicions ha guanyat" jugadors={d.mesPosicions} />
          <Bloc titol="Qui més ha baixat" jugadors={d.mesBaixada} />
          <Bloc
            titol="Pugen de categoria"
            jugadors={d.pujadesCategoria.map((j) => ({ ...j, valor: `a ${CATEGORIA_NOM[j.ara - 1]}` }))}
          />
        </View>
        <View style={sd.columna}>
          <Bloc titol="Més partides" jugadors={d.mesPartides} />
          <Bloc titol="Més victòries" jugadors={d.mesVictories} />
          <Bloc titol="Millor percentatge (mínim 20 partides)" jugadors={d.millorPercentatge} />
          <Bloc
            titol={d.debutants.length > 10 ? `Debutants (els 10 primers de ${d.debutants.length})` : 'Debutants'}
            jugadors={d.debutants.slice(0, 10)}
          />
          <Bloc
            titol={d.recuperats.length > 10 ? `Tornen a ser actius (10 de ${d.recuperats.length})` : 'Tornen a ser actius'}
            jugadors={d.recuperats.slice(0, 10)}
          />
        </View>
      </View>
    </View>
  )
}

// --- Paginació -----------------------------------------------------------------

function trosseja<T>(files: T[], primera: number, resta: number): T[][] {
  const pagines = [files.slice(0, primera)]
  for (let i = primera; i < files.length; i += resta) pagines.push(files.slice(i, i + resta))
  return pagines.filter((p) => p.length > 0)
}

export function DocumentBarruf({ informe, destacats }: { informe: Informe; destacats?: Destacats }) {
  const especial = informe.especial !== null
  const actius = trosseja(informe.actius, FILES_PRIMERA, FILES_PAGINA)
  const espera = trosseja(informe.espera, FILES_PRIMERA_ESPERA, FILES_PAGINA)
  const llegendaApart = (actius.at(-1)?.length ?? 0) > FILES_AMB_LLEGENDA


  return (
    <Document title={`BARRUF ${informe.numero}`} author="AJUSC" creator="BARRUF — AJUSC">
      {actius.map((files, i) => (
        <Page key={`a${i}`} size="A4" style={s.pagina}>
          {i === 0 ? (
            <>
              <Capcalera informe={informe} />
              <Llegenda especial={especial} />
            </>
          ) : null}
          <CapTaula numero={informe.numero} temporada={informe.temporada} espera={false} especial={especial} />
          {files.map((f, j) => (
            <FilaTaula key={f.nom} f={f} index={j} espera={false} especial={especial} />
          ))}
          {i === actius.length - 1 && !llegendaApart ? <LlegendaClubs clubs={informe.clubs} /> : null}
          <Text style={s.numPagina} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      ))}
      {llegendaApart ? (
        <Page size="A4" style={s.pagina}>
          <LlegendaClubs clubs={informe.clubs} />
          <Text style={s.numPagina} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      ) : null}
      {espera.map((files, i) => (
        <Page key={`e${i}`} size="A4" style={s.pagina}>
          {i === 0 ? (
            <View style={[s.bandaEspera, { backgroundColor: fons(especial) }]}>
              <Text style={s.titolEspera}>BARRUF en espera</Text>
              <Text style={s.liniaEspera}>
                exp = jugadors en expectativa, amb menys de 10 partides, amb resultat publicat, en
                competicions de scrabble clàssic
              </Text>
              <Text style={s.liniaEspera}>
                inact = jugadors inactius, tenen més de 10 partides, però cap resultat publicat en la
                temporada actual ni en l&apos;anterior
              </Text>
            </View>
          ) : null}
          <CapTaula numero={informe.numero} temporada={informe.temporada} espera especial={especial} />
          {files.map((f, j) => (
            <FilaTaula key={f.nom} f={f} index={j} espera especial={especial} />
          ))}
          <Text style={s.numPagina} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      ))}
      {destacats ? (
        <Page size="A4" style={s.pagina}>
          <PaginaDestacats d={destacats} />
          <Text style={s.numPagina} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      ) : null}
    </Document>
  )
}

/** El PDF d'una edició, a punt per servir. */
export function renderitzaBarruf(informe: Informe, destacats?: Destacats): Promise<Buffer> {
  // `renderToBuffer` vol un element de `<Document>` i no sap que el component
  // en retorna un.
  const document = (<DocumentBarruf informe={informe} destacats={destacats} />) as unknown as ReactElement<DocumentProps>
  return renderToBuffer(document)
}
