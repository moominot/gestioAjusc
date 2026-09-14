/**
 * Constants del BARRUF.
 *
 * Extretes de la pestanya `DadesTorneig` del GENERADOR_BARRUF de l'AJUSC.
 * NO les toqueu sense acordar-ho: cada una d'aquestes xifres forma part de les
 * bases de càlcul publicades i canviar-les invalida tota la cadena històrica.
 */

/**
 * Dispersió de la funció d'esperança, en punts de BARRUF.
 *
 * Al full apareix com a `NORMDIST(diferència; 0; 283,84; TRUE)`. És pràcticament
 * 200·√2 ≈ 282,84, la dispersió de l'Elo clàssic (diferència de dues normals de
 * desviació 200), però es conserva el valor exacte del full.
 */
export const SIGMA = 283.84

/** BARRUF de sortida d'un jugador nou. Cel·la INICI!B8 i DadesTorneig!H3. */
export const BARRUF_INICIAL = 950

/** Per damunt d'aquest nombre de partides acumulades, el factor K baixa. */
export const LLINDAR_PARTIDES_K = 50

/** Factor K d'un jugador veterà (més de 50 partides acumulades). */
export const K_VETERA = 20

/** Factor K d'un jugador amb poc bagatge (50 partides acumulades o menys). */
export const K_NOVELL = 30

/**
 * Per damunt d'aquest nombre de partides el BARRUF deixa de ser provisional.
 * Amb 10 partides o menys el jugador surt a la llista de no actius com a
 * expectativa (`exp`).
 */
export const LLINDAR_PARTIDES_ACTIU = 10

/**
 * Temporades senceres sense jugar cap campionat barrufat abans de passar a
 * inactiu. La transició s'aplica a l'inici de temporada, el setembre.
 */
export const TEMPORADES_INACTIVITAT = 2
