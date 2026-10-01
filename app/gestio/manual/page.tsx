import Link from 'next/link'

export const metadata = { title: 'Manual de gestió' }

const SECCIONS = [
  ['barruf', 'Com funciona el BARRUF'],
  ['importar', 'Importar un campionat'],
  ['editar', 'Corregir un campionat'],
  ['publicar', 'Publicar el BARRUF'],
  ['jugadors', 'Jugadors i duplicats'],
  ['pdf', 'PDF, especial de temporada i comparatives'],
  ['gestors', 'Gestors, contrasenya i registre de canvis'],
  ['arxiu', 'L’arxiu (2014-2025)'],
] as const

function Seccio({ id, titol, children }: { id: string; titol: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{titol}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-stone-700 [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal">
        {children}
      </div>
    </section>
  )
}

export default function Manual() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <Link href="/gestio" className="text-sm text-stone-500 underline hover:text-stone-900">
          ← Gestió
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Manual de gestió</h1>
        <p className="mt-1 text-sm text-stone-600">
          Què fa cada pantalla de la gestió i què passa quan premeu cada botó.
        </p>
        <nav className="mt-4 rounded-lg border border-stone-200 bg-white p-4 text-sm">
          <ol className="grid gap-1 sm:grid-cols-2">
            {SECCIONS.map(([id, titol], i) => (
              <li key={id}>
                <a href={`#${id}`} className="underline hover:text-stone-900">
                  {i + 1}. {titol}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <Seccio id="barruf" titol="1. Com funciona el BARRUF">
        <p>
          El BARRUF és una <strong>cadena</strong>: cada edició parteix de l’anterior i hi suma els
          campionats nous. El punt de partida és la <strong>llavor</strong>, l’edició 190 (final de
          la temporada 2024-25), que es va carregar tal com la va publicar l’AJUSC.
        </p>
        <p>
          Un campionat entra a la cadena quan compleix dues condicions, que es marquen en importar-lo
          o editar-lo:
        </p>
        <ul>
          <li><strong>Computa per al BARRUF</strong>: es desmarca per als campionats que no hi han de comptar.</li>
          <li>
            <strong>S’ha acabat</strong>: un campionat es barrufa sencer quan acaba, mai per trams. Mentre
            no estigui marcat com a acabat, es pot consultar però no mou cap puntuació.
          </li>
        </ul>
        <p>
          Per a cada jugador i campionat es calculen les victòries <strong>esperades</strong> segons
          la diferència de BARRUF amb cada rival, i la variació és{' '}
          <em>(victòries − esperades) × K</em>, arrodonida. K és 30 per a qui, comptant les del
          campionat, no passa de 50 partides, i 20 per a la resta. Un jugador és{' '}
          <strong>actiu</strong> amb més de 10 partides, està en <strong>expectativa</strong> amb 10
          o menys, i passa a <strong>inactiu</strong> si fa dues temporades que no juga.
        </p>
      </Seccio>

      <Seccio id="importar" titol="2. Importar un campionat">
        <p>A Gestió → Importar. Es pot fer de tres maneres:</p>
        <ul>
          <li>
            <strong>SwissPerfect</strong>: els fitxers <code>.trn</code> (participants) i{' '}
            <code>.sco</code> (resultats), i opcionalment l’<code>.ini</code> (nom i organitzador).
          </li>
          <li>
            <strong>Full de càlcul o CSV</strong> amb les columnes Ronda, Jugador 1, Puntuació 1,
            Jugador 2 i Puntuació 2. La puntuació tant pot ser la de la partida com el resultat (1,
            0,5 o 0). Per a un descans, deixeu l’adversari en blanc o poseu-hi BYE.
          </li>
          <li><strong>Enganxar</strong> les files copiades directament del full de càlcul.</li>
        </ul>
        <p>
          Opcionalment, per a cada jugador (columnes acabades en 1 i 2): <strong>Scrabbles</strong>,
          la millor jugada (<strong>Mot</strong> i <strong>Puntsmot</strong>) i la millor amb lletra
          especial (<strong>Lletra</strong> i <strong>Punts lletra</strong>).
        </p>
        <p><strong>Els noms.</strong> Cada nom del fitxer es busca al registre:</p>
        <ul>
          <li><em>Trobat</em>: el nom coincideix exactament (sense accents ni majúscules).</li>
          <li><em>Per àlies</em>: és una manera d’escriure’l que ja s’havia validat en una importació anterior.</li>
          <li>
            <em>Cal decidir</em>: es proposen candidats, primer per semblança del nom complet, després
            pels dos cognoms i després per un cognom. Si hi ha un jugador amb la mateixa puntuació
            que porta el fitxer, s’indica. També es pot cercar a tot el registre.
          </li>
          <li><em>Alta nova</em>: si no és ningú del registre, es dona d’alta en desar.</li>
        </ul>
        <p>
          Cada nom validat queda desat com a àlies del jugador: la propera importació que l’escrigui
          igual el reconeixerà sola.
        </p>
        <p>
          Abans de desar, el quadre <strong>Què s’importarà</strong> mostra el campionat, la
          classificació que en resulta (amb qui serà cada jugador al registre) i totes les partides
          ronda per ronda. Res no es desa fins que premeu <em>Importar el campionat</em>.
        </p>
      </Seccio>

      <Seccio id="editar" titol="3. Corregir un campionat">
        <p>
          Des de la fitxa del campionat, <em>Editar</em> (només els gestors el veuen). S’hi poden
          canviar les dades (nom, data, temporada, organitzador, si computa, si s’ha acabat) i el
          resultat i la puntuació de cada partida.
        </p>
        <p>
          Si l’organitzador envia els resultats corregits o amb estadístiques,{' '}
          <em>torneu a importar el campionat</em> des de la mateixa pàgina: se’n substitueixen els
          participants i totes les partides, i les dades del campionat es conserven. Les correccions
          fetes a mà es perden.
        </p>
        <p>
          Cap correcció no canvia els BARRUF ja publicats: entra a la propera publicació, que rejuga
          tota la cadena amb les dades corregides.
        </p>
      </Seccio>

      <Seccio id="publicar" titol="4. Publicar el BARRUF">
        <p>A Gestió → Publicar. Hi ha dos passos:</p>
        <ol>
          <li>
            <strong>Calcular sense desar.</strong> Agafa la llavor (edició 190) i rejuga, en
            l’ordre de la cadena, tots els campionats que computen i estan acabats posteriors a la
            llavor, també els que ja estaven publicats. Calcula el BARRUF, les partides i victòries
            totals i de la temporada, l’estat, la posició i si és debutant de cada jugador. Mostra
            quin número tindria l’edició, quants jugadors hi ha i qui puja i baixa més.{' '}
            <strong>No desa res</strong>: es pot repetir tantes vegades com calgui.
          </li>
          <li>
            <strong>Publicar el BARRUF N.</strong> Desa el càlcul com a edició nova:
            <ul className="mt-1">
              <li>crea l’edició amb el número següent, la data i la temporada triades;</li>
              <li>desa l’estat de tots els jugadors en aquesta edició (és el que mostra la classificació i el PDF);</li>
              <li>marca els campionats acabats que encara no havia computat cap edició com a computats en aquesta, i n’anota els noms;</li>
              <li>refà les variacions per campionat de la cadena (l’evolució de cada jugador). Les dels campionats de l’arxiu no es toquen;</li>
              <li>suma els resultats i campionats acumulats des del 2000.</li>
            </ul>
          </li>
        </ol>
        <p>
          <strong>Les edicions ja publicades no es modifiquen mai</strong>: són el que es va publicar
          en el seu moment. Si es corregeix un resultat antic, l’edició nova ja el porta corregit, i
          les antigues queden com eren. Publicar no es pot desfer des de l’aplicació.
        </p>
        <p>
          La <strong>temporada de referència</strong> decideix els estats: un jugador passa a inactiu
          si no ha jugat ni en aquesta temporada ni en l’anterior. A l’inici d’una temporada nova
          (setembre), trieu-la per aplicar les baixes.
        </p>
      </Seccio>

      <Seccio id="jugadors" titol="5. Jugadors i duplicats">
        <p>
          A Gestió → Jugadors es pot corregir el nom i el club d’un jugador. El nom d’abans es desa
          com a àlies.
        </p>
        <p>
          A <em>Possibles duplicats</em> surten parelles de fitxes amb noms semblants que no han
          coincidit mai en cap campionat (si haguessin jugat tots dos el mateix campionat, serien dues
          persones). Per a cada parella podeu:
        </p>
        <ul>
          <li>
            <strong>Fusionar-les</strong>, triant quina queda: partides, inscripcions, historial del
            BARRUF, quotes i àlies passen a la que queda. El número de l’altra queda reservat i hi
            redirigeix. On totes dues surten en una mateixa edició antiga, es conserva la fila amb
            més partides. No es pot desfer des de l’aplicació.
          </li>
          <li><strong>Dir que no són la mateixa persona</strong>: la parella no tornarà a sortir.</li>
        </ul>
        <p>
          Hi ha també <em>Fusionar a mà</em> per als casos que el filtre no troba (un canvi de cognom,
          un sobrenom). Com sempre, la fusió entra al BARRUF a la propera publicació.
        </p>
      </Seccio>

      <Seccio id="pdf" titol="6. PDF, especial de temporada i comparatives">
        <ul>
          <li>
            <strong>PDF d’una edició</strong>: a la classificació, <em>Descarrega el PDF</em>, amb el
            format de l’AJUSC. Qualsevol edició: <code>/barruf/pdf?edicio=209</code>.
          </li>
          <li>
            <strong>Especial de final de temporada</strong>: a la classificació,{' '}
            <em>Resum de la temporada</em>. Compara el darrer BARRUF de la temporada anterior amb el
            darrer d’aquesta, amb els destacats (podi, pujades, canvis de categoria, debutants…). El
            PDF de l’especial porta una pàgina de destacats al final.
          </li>
          <li>
            <strong>Comparativa entre dues edicions</strong>:{' '}
            <code>/barruf/pdf?edicio=210&amp;des_de=190</code>.
          </li>
        </ul>
      </Seccio>

      <Seccio id="gestors" titol="7. Gestors, contrasenya i registre de canvis">
        <ul>
          <li>
            <strong>Gestors</strong>: un gestor pot donar d’alta un altre gestor amb nom, correu i una
            contrasenya inicial, i treure’n (el compte i el seu historial es conserven).
          </li>
          <li>
            <strong>Contrasenya</strong>: cadascú la pot canviar a Gestió → Contrasenya. Si s’oblida,
            a la pàgina d’entrada hi ha <em>He oblidat la contrasenya</em>, que envia un enllaç per
            entrar.
          </li>
          <li>
            <strong>Registre de canvis</strong>: tot el que canvia un gestor queda apuntat amb qui,
            quan i com era abans i després, agrupat per acció.
          </li>
        </ul>
      </Seccio>

      <Seccio id="arxiu" titol="8. L’arxiu (2014-2025)">
        <p>
          Les edicions 70 a 189 i els seus campionats són <strong>l’arxiu</strong>: es van carregar
          dels fulls i dels PDF que va publicar l’AJUSC, i l’estat de cada edició s’ha contrastat amb
          el seu PDF. Es poden consultar i donen estadístiques, però <strong>no es rejuguen</strong>:
          la cadena comença a la llavor.
        </p>
        <p>
          D’alguns campionats antics només se sap qui va jugar contra qui i les victòries totals de
          cada jugador, no el resultat de cada partida; a la fitxa surten com a «contra». Molts no
          tenien data i porten la del final de temporada.
        </p>
      </Seccio>
    </div>
  )
}
