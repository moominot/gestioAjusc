-- =============================================================================
-- Fusions de duplicats: l'historial del BARRUF, sencer
-- =============================================================================
-- En fusionar dues fitxes, de cada edició on sortien totes dues es quedava
-- només la fila amb més partides, i es perdien les partides de l'altra
-- (2026-10-02, en revisar la Bel Miquel).
--
-- (a) Bel Miquel, Eva Cama i Joan Melis: les dues fitxes eren posteriors a la
--     llavor (edició 190). Es refà el seu historial de les edicions 191 a 210
--     a partir dels campionats (barruf_variacions, que ja són de la cadena
--     rejugada amb les partides unides), amb la posició que els toca pel seu
--     BARRUF; la dels altres no es toca. La 211 ja es va publicar amb tot unit.
-- (b) Susanna Jiménez i Joan Antoni Cerrato: la fitxa perduda era d'abans de
--     la llavor (3 partides cadascú, sense victòries). Se sumen a les partides
--     totals d'aquí endavant; el BARRUF publicat no es toca.
-- (c) La fusió, d'ara endavant, suma les partides i les victòries.

-- --- (a) --------------------------------------------------------------------
CREATE TEMP TABLE historial_nou AS
WITH jug AS (
    SELECT id, numero FROM jugadors WHERE numero IN (595, 608, 609) AND fusionat_a IS NULL
),
eds AS (
    SELECT id, numero, temporada_codi FROM barruf_edicions WHERE numero BETWEEN 191 AND 210
),
llavor AS (
    SELECT v.* FROM barruf_valors v JOIN barruf_edicions e ON e.id = v.edicio_id WHERE e.numero = 190
),
vars AS (
    SELECT x.jugador_id, c.primera_edicio AS ed, c.temporada_codi AS temp, c.data, c.ordre,
           x.partides, x.victories, x.barruf_despres
    FROM barruf_variacions x JOIN campionats c ON c.id = x.campionat_id
    WHERE c.primera_edicio BETWEEN 191 AND 210
),
calc AS (
    SELECT j.id AS jugador_id, e.id AS edicio_id, e.numero, e.temporada_codi AS temporada,
           coalesce((SELECT v.barruf_despres FROM vars v WHERE v.jugador_id = j.id AND v.ed <= e.numero
                     ORDER BY v.ed DESC, v.data DESC, v.ordre DESC LIMIT 1), l.barruf, 950) AS barruf,
           coalesce(l.partides_totals, 0)
             + coalesce((SELECT sum(v.partides) FROM vars v WHERE v.jugador_id = j.id AND v.ed <= e.numero), 0) AS pt,
           coalesce(l.victories_totals, 0)
             + coalesce((SELECT sum(v.victories) FROM vars v WHERE v.jugador_id = j.id AND v.ed <= e.numero), 0) AS vt,
           coalesce((SELECT sum(v.partides) FROM vars v WHERE v.jugador_id = j.id AND v.ed <= e.numero
                     AND v.temp = e.temporada_codi), 0) AS ptemp,
           coalesce((SELECT sum(v.victories) FROM vars v WHERE v.jugador_id = j.id AND v.ed <= e.numero
                     AND v.temp = e.temporada_codi), 0) AS vtemp,
           GREATEST(l.darrera_temporada,
                    (SELECT max(v.temp) FROM vars v WHERE v.jugador_id = j.id AND v.ed <= e.numero)) AS darrera
    FROM jug j CROSS JOIN eds e LEFT JOIN llavor l ON l.jugador_id = j.id
)
SELECT jugador_id, edicio_id, numero, barruf, pt, vt, ptemp, vtemp, darrera,
       CASE WHEN pt <= 10 THEN 'exp'
            WHEN darrera IS NULL THEN 'inact'
            WHEN left(darrera, 4)::INTEGER >= left(temporada, 4)::INTEGER - 2 THEN 'act'
            ELSE 'inact' END AS estat,
       pt > 10 AND pt - ptemp <= 10 AS debutant
FROM calc
WHERE pt > 0;

UPDATE barruf_valors b
SET barruf = h.barruf, partides_totals = h.pt, victories_totals = h.vt,
    partides_temporada = h.ptemp, victories_temporada = h.vtemp,
    darrera_temporada = h.darrera, estat = h.estat::estat_jugador,
    debutant = h.debutant, cohort_llegat = false
FROM historial_nou h
WHERE b.jugador_id = h.jugador_id AND b.edicio_id = h.edicio_id;

INSERT INTO barruf_valors (edicio_id, jugador_id, barruf, partides_totals, victories_totals,
                           partides_temporada, victories_temporada, estat, darrera_temporada,
                           cohort_llegat, debutant, posicio)
SELECT h.edicio_id, h.jugador_id, h.barruf, h.pt, h.vt, h.ptemp, h.vtemp, h.estat::estat_jugador,
       h.darrera, false, h.debutant, NULL
FROM historial_nou h
WHERE NOT EXISTS (SELECT 1 FROM barruf_valors b WHERE b.jugador_id = h.jugador_id AND b.edicio_id = h.edicio_id);

-- La posició d'aquests tres jugadors en aquelles edicions: la que els toca pel
-- seu BARRUF entre els altres, amb el criteri dels fulls oficials (BARRUF
-- arrodonit; els empatats comparteixen posició). La dels altres jugadors no es
-- toca: és la publicada, on la fitxa duplicada ocupava un lloc propi.
UPDATE barruf_valors b
SET posicio = CASE WHEN b.estat = 'act' THEN 1 + (
        SELECT count(*) FROM barruf_valors o
        WHERE o.edicio_id = b.edicio_id AND o.estat = 'act' AND o.jugador_id <> b.jugador_id
          AND round(o.barruf) > round(b.barruf)) END
FROM historial_nou h
WHERE b.jugador_id = h.jugador_id AND b.edicio_id = h.edicio_id;

DROP TABLE historial_nou;

-- --- (b) --------------------------------------------------------------------
-- Susanna Jiménez: les 3 partides d'abans del 2014 de la fitxa «Susana Jimenez»,
-- perdudes a l'edició 105. Joan Antoni Cerrato: les 3 del 2023-24 de l'altra
-- fitxa, perdudes a l'edició 184.
UPDATE barruf_valors b
SET partides_totals = b.partides_totals + 3
FROM barruf_edicions e, jugadors j
WHERE e.id = b.edicio_id AND j.id = b.jugador_id
  AND ((j.numero = 412 AND e.numero >= 105) OR (j.numero = 559 AND e.numero >= 184));

-- --- (c) --------------------------------------------------------------------
/**
 * Passa tot el que és del duplicat al jugador bo i deixa el duplicat com a
 * fitxa fusionada (`fusionat_a`). El número del duplicat no es reutilitza mai:
 * queda reservat i els enllaços vells redirigeixen al bo.
 *
 * No es deixa fusionar dues fitxes que han coincidit en un mateix campionat:
 * si hi han jugat tots dos, són dues persones.
 *
 * Historial del BARRUF: les edicions on només surt el duplicat passen al bo.
 * On surten tots dos (el BARRUF publicat els comptava com dues persones), el
 * BARRUF, l'estat i la posició són els de la fila amb més partides totals, i
 * les partides i victòries se sumen. Abans (fins al 2026-10-02) es quedava
 * només la fila amb més partides i es perdien les de l'altra. Les edicions
 * publicades no es recalculen: la propera publicació rejugarà la cadena amb
 * les partides ja unides.
 */
CREATE OR REPLACE FUNCTION fusiona_jugadors(p_bo INTEGER, p_duplicat INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_bo        jugadors%ROWTYPE;
    v_dup       jugadors%ROWTYPE;
    v_comuns    INTEGER;
    v_partides  INTEGER;
    v_edicions  INTEGER;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden fusionar jugadors';
    END IF;

    SELECT * INTO v_bo FROM jugadors WHERE numero = p_bo FOR UPDATE;
    SELECT * INTO v_dup FROM jugadors WHERE numero = p_duplicat FOR UPDATE;
    IF v_bo.id IS NULL OR v_dup.id IS NULL THEN
        RAISE EXCEPTION 'No existeix el jugador % o el %', p_bo, p_duplicat;
    END IF;
    IF v_bo.id = v_dup.id THEN
        RAISE EXCEPTION 'Un jugador no es pot fusionar amb ell mateix';
    END IF;
    IF v_bo.fusionat_a IS NOT NULL OR v_dup.fusionat_a IS NOT NULL THEN
        RAISE EXCEPTION 'Algun dels dos ja està fusionat amb una altra fitxa';
    END IF;

    SELECT count(*) INTO v_comuns
    FROM inscripcions a JOIN inscripcions b ON b.campionat_id = a.campionat_id
    WHERE a.jugador_id = v_bo.id AND b.jugador_id = v_dup.id;
    IF v_comuns = 0 THEN
        SELECT count(DISTINCT campionat_id) INTO v_comuns FROM partides
        WHERE (jugador_1_id = v_bo.id OR jugador_2_id = v_bo.id)
          AND campionat_id IN (SELECT campionat_id FROM partides
                               WHERE jugador_1_id = v_dup.id OR jugador_2_id = v_dup.id);
    END IF;
    IF v_comuns > 0 THEN
        RAISE EXCEPTION '% i % han coincidit en % campionats: són dues persones',
            v_bo.nom_complet, v_dup.nom_complet, v_comuns;
    END IF;

    -- Partides, inscripcions i variacions: no poden xocar, perquè no comparteixen campionat.
    UPDATE partides SET jugador_1_id = v_bo.id WHERE jugador_1_id = v_dup.id;
    GET DIAGNOSTICS v_partides = ROW_COUNT;
    UPDATE partides SET jugador_2_id = v_bo.id WHERE jugador_2_id = v_dup.id;
    UPDATE inscripcions SET jugador_id = v_bo.id WHERE jugador_id = v_dup.id;
    UPDATE barruf_variacions SET jugador_id = v_bo.id WHERE jugador_id = v_dup.id;

    -- Historial del BARRUF: on surten tots dos, el BARRUF, l'estat i la posició
    -- són els de la fila amb més partides, i s'hi sumen les partides i les
    -- victòries de l'altra.
    UPDATE barruf_valors b
    SET barruf = d.barruf, estat = d.estat, posicio = d.posicio,
        debutant = d.debutant, cohort_llegat = d.cohort_llegat
    FROM barruf_valors d
    WHERE b.jugador_id = v_bo.id AND d.jugador_id = v_dup.id
      AND d.edicio_id = b.edicio_id AND d.partides_totals > b.partides_totals;
    UPDATE barruf_valors b
    SET partides_totals = b.partides_totals + d.partides_totals,
        victories_totals = b.victories_totals + d.victories_totals,
        partides_temporada = b.partides_temporada + d.partides_temporada,
        victories_temporada = b.victories_temporada + d.victories_temporada,
        darrera_temporada = GREATEST(b.darrera_temporada, d.darrera_temporada)
    FROM barruf_valors d
    WHERE b.jugador_id = v_bo.id AND d.jugador_id = v_dup.id AND d.edicio_id = b.edicio_id;
    DELETE FROM barruf_valors d USING barruf_valors b
    WHERE d.jugador_id = v_dup.id AND b.jugador_id = v_bo.id AND b.edicio_id = d.edicio_id;
    UPDATE barruf_valors SET jugador_id = v_bo.id WHERE jugador_id = v_dup.id;
    GET DIAGNOSTICS v_edicions = ROW_COUNT;

    -- Quotes: si tots dos en tenen d'un mateix exercici, es queda la del bo.
    DELETE FROM quotes d USING quotes b
    WHERE d.jugador_id = v_dup.id AND b.jugador_id = v_bo.id AND b.exercici = d.exercici;
    UPDATE quotes SET jugador_id = v_bo.id WHERE jugador_id = v_dup.id;

    -- Els àlies del duplicat, i el seu nom, reconeixen a partir d'ara el bo.
    UPDATE jugador_alies SET jugador_id = v_bo.id WHERE jugador_id = v_dup.id;
    INSERT INTO jugador_alies (jugador_id, alies, alies_norm, origen)
    VALUES (v_bo.id, v_dup.nom_complet, normalitza_nom(v_dup.nom_complet),
            'fusió amb el núm. ' || v_dup.numero)
    ON CONFLICT (alies_norm) DO UPDATE SET jugador_id = EXCLUDED.jugador_id;

    -- Si el bo no tenia club, es queda el del duplicat.
    UPDATE jugadors SET club_id = COALESCE(v_bo.club_id, v_dup.club_id) WHERE id = v_bo.id;

    -- Les fitxes que ja apuntaven al duplicat, ara apunten al bo.
    UPDATE jugadors SET fusionat_a = v_bo.id WHERE fusionat_a = v_dup.id;
    UPDATE jugadors SET fusionat_a = v_bo.id WHERE id = v_dup.id;

    DELETE FROM jugadors_no_duplicats WHERE v_dup.id IN (jugador_a, jugador_b);

    RETURN jsonb_build_object(
        'bo', v_bo.numero, 'nom', v_bo.nom_complet,
        'duplicat', v_dup.numero, 'nom_duplicat', v_dup.nom_complet,
        'edicions', v_edicions
    );
END;
$$;

