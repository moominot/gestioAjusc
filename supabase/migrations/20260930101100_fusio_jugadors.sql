-- =============================================================================
-- Jugadors duplicats: detectar-los i fusionar-los
-- =============================================================================
-- Una mateixa persona pot haver acabat amb dues fitxes: un nom escrit de dues
-- maneres en campionats diferents, una alta nova que era un jugador antic… La
-- gestió en troba els candidats per la semblança dels noms (això es fa a
-- l'aplicació) i aquí hi ha el que cal a la base de dades:
--
--  · `dades_duplicats()`: per a cada jugador, el que la gestió necessita per
--    decidir (partides, temporades, campionats).
--  · `fusiona_jugadors(bo, duplicat)`: passa tot el que és del duplicat al bo.
--  · `jugadors_no_duplicats`: parelles que un gestor ha dit que són dues
--    persones, perquè no tornin a sortir.
--  · `jugador_fusionat_a(numero)`: on ha anat a parar un número fusionat, per
--    redirigir-hi els enllaços vells.
-- =============================================================================

CREATE TABLE jugadors_no_duplicats (
    jugador_a   UUID NOT NULL REFERENCES jugadors(id) ON DELETE CASCADE,
    jugador_b   UUID NOT NULL REFERENCES jugadors(id) ON DELETE CASCADE,
    creat_el    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (jugador_a, jugador_b),
    CHECK (jugador_a < jugador_b)
);

ALTER TABLE jugadors_no_duplicats ENABLE ROW LEVEL SECURITY;
CREATE POLICY gestors ON jugadors_no_duplicats FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
GRANT SELECT, INSERT, DELETE ON jugadors_no_duplicats TO authenticated;

-- -----------------------------------------------------------------------------
-- Dades per trobar duplicats
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dades_duplicats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden cercar duplicats';
    END IF;

    RETURN jsonb_build_object(
        'jugadors', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'numero', j.numero,
                'nom', j.nom_complet,
                'club', cl.nom,
                'partides', COALESCE(v.partides, 0),
                'primera', t.primera,
                'darrera', t.darrera,
                'campionats', COALESCE(t.campionats, '[]'::jsonb)
            )), '[]'::jsonb)
            FROM jugadors j
            LEFT JOIN clubs cl ON cl.id = j.club_id
            LEFT JOIN LATERAL (
                SELECT max(bv.partides_totals) AS partides
                FROM barruf_valors bv WHERE bv.jugador_id = j.id
            ) v ON TRUE
            LEFT JOIN LATERAL (
                SELECT min(c.temporada_codi) AS primera,
                       max(c.temporada_codi) AS darrera,
                       jsonb_agg(c.id) AS campionats
                FROM inscripcions i JOIN campionats c ON c.id = i.campionat_id
                WHERE i.jugador_id = j.id
            ) t ON TRUE
            WHERE j.fusionat_a IS NULL
        ),
        'descartades', (
            SELECT COALESCE(jsonb_agg(jsonb_build_array(a.numero, b.numero)), '[]'::jsonb)
            FROM jugadors_no_duplicats n
            JOIN jugadors a ON a.id = n.jugador_a
            JOIN jugadors b ON b.id = n.jugador_b
        )
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- Descartar una parella
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION descarta_duplicat(p_numero_a INTEGER, p_numero_b INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_a UUID;
    v_b UUID;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden descartar duplicats';
    END IF;
    SELECT id INTO v_a FROM jugadors WHERE numero = p_numero_a;
    SELECT id INTO v_b FROM jugadors WHERE numero = p_numero_b;
    IF v_a IS NULL OR v_b IS NULL OR v_a = v_b THEN
        RAISE EXCEPTION 'Cal dos jugadors diferents';
    END IF;
    INSERT INTO jugadors_no_duplicats (jugador_a, jugador_b)
    VALUES (LEAST(v_a, v_b), GREATEST(v_a, v_b))
    ON CONFLICT DO NOTHING;
END;
$$;

-- -----------------------------------------------------------------------------
-- Fusionar
-- -----------------------------------------------------------------------------
/**
 * Passa tot el que és del duplicat al jugador bo i deixa el duplicat com a
 * fitxa fusionada (`fusionat_a`). El número del duplicat no es reutilitza mai:
 * queda reservat i els enllaços vells redirigeixen al bo.
 *
 * No es deixa fusionar dues fitxes que han coincidit en un mateix campionat:
 * si hi han jugat tots dos, són dues persones.
 *
 * Historial del BARRUF: les edicions on només surt el duplicat passen al bo.
 * On surten tots dos (el BARRUF publicat els comptava com dues persones), es
 * queda la fila amb més partides totals, que és la fitxa que feia més temps
 * que jugava. Les edicions publicades no es recalculen: la propera publicació
 * rejugarà la cadena amb les partides ja unides.
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

    -- Historial del BARRUF: on surten tots dos, es queda la fila amb més partides.
    DELETE FROM barruf_valors b USING barruf_valors d
    WHERE b.jugador_id = v_bo.id AND d.jugador_id = v_dup.id
      AND d.edicio_id = b.edicio_id AND d.partides_totals > b.partides_totals;
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

-- -----------------------------------------------------------------------------
-- On ha anat a parar un número fusionat
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jugador_fusionat_a(p_numero INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT b.numero FROM jugadors d JOIN jugadors b ON b.id = d.fusionat_a WHERE d.numero = p_numero;
$$;

REVOKE EXECUTE ON FUNCTION dades_duplicats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION dades_duplicats() TO authenticated;
GRANT EXECUTE ON FUNCTION descarta_duplicat(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION fusiona_jugadors(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION jugador_fusionat_a(INTEGER) TO anon, authenticated;
