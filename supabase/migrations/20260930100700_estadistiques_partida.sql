-- =============================================================================
-- Estadístiques de partida i reimportació de campionats
-- =============================================================================
-- Tres coses:
--
--  · Cada partida pot dur, per a cada jugador, la millor jugada (mot i punts)
--    i la millor jugada amb lletra especial (mot i punts). Els scrabbles ja hi
--    eren (scrabbles_1, scrabbles_2).
--  · La importació les desa quan el fitxer les porta, i un campionat ja desat
--    es pot tornar a importar: se'n substitueixen els participants i les
--    partides, i les dades del campionat es conserven.
--  · La fitxa del campionat en dona el resum per jugador.
-- =============================================================================

ALTER TABLE partides
    ADD COLUMN mot_1            TEXT,
    ADD COLUMN punts_mot_1      INTEGER CHECK (punts_mot_1 >= 0),
    ADD COLUMN mot_lletra_1     TEXT,
    ADD COLUMN punts_lletra_1   INTEGER CHECK (punts_lletra_1 >= 0),
    ADD COLUMN mot_2            TEXT,
    ADD COLUMN punts_mot_2      INTEGER CHECK (punts_mot_2 >= 0),
    ADD COLUMN mot_lletra_2     TEXT,
    ADD COLUMN punts_lletra_2   INTEGER CHECK (punts_lletra_2 >= 0);

COMMENT ON COLUMN partides.mot_1 IS 'Millor jugada del jugador 1: el mot, en majúscules.';
COMMENT ON COLUMN partides.mot_lletra_1 IS 'Millor jugada del jugador 1 amb lletra especial (Ç, L·L, NY, Q, X…).';

-- -----------------------------------------------------------------------------
-- Participants i partides d'un campionat, comú a importar i reimportar
-- -----------------------------------------------------------------------------
/**
 * Associa els participants al registre (o els dona d'alta), els inscriu i
 * desa les partides. El campionat ha d'existir i no tenir-ne cap.
 *
 * `p_partides`: { ronda, local_1, local_2, resultat_1, punts_1, punts_2,
 *   scrabbles_1, scrabbles_2, mot_1, punts_mot_1, mot_lletra_1, punts_lletra_1,
 *   mot_2, punts_mot_2, mot_lletra_2, punts_lletra_2 }, amb tot el que va
 * després de punts_2 opcional.
 */
CREATE OR REPLACE FUNCTION desa_participants_i_partides(
    p_campionat_id  UUID,
    p_origen_alies  TEXT,
    p_participants  JSONB,
    p_partides      JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_participant   JSONB;
    v_jugador_id    UUID;
    v_nom           TEXT;
    v_numero        INTEGER;
    v_correspon     JSONB := '{}'::JSONB;   -- local_id (text) -> uuid (text)
    v_nous          INTEGER := 0;
    v_alies         INTEGER := 0;
    v_partides      INTEGER := 0;
    v_desconegut    TEXT;
BEGIN
    IF jsonb_array_length(p_participants) = 0 THEN
        RAISE EXCEPTION 'El campionat no té cap participant';
    END IF;

    FOR v_participant IN SELECT * FROM jsonb_array_elements(p_participants)
    LOOP
        v_nom := btrim(v_participant->>'nom');
        IF v_nom = '' OR v_nom IS NULL THEN
            RAISE EXCEPTION 'Hi ha un participant sense nom (local_id %)',
                v_participant->>'local_id';
        END IF;

        v_numero := (v_participant->>'jugador_numero')::INTEGER;

        IF v_numero IS NOT NULL THEN
            -- Un jugador fusionat redirigeix cap al bo.
            SELECT COALESCE(fusionat_a, id) INTO v_jugador_id
            FROM jugadors WHERE numero = v_numero;

            IF v_jugador_id IS NULL THEN
                RAISE EXCEPTION 'No existeix cap jugador amb el número %', v_numero;
            END IF;
        ELSE
            INSERT INTO jugadors (nom_complet) VALUES (v_nom)
            RETURNING id INTO v_jugador_id;
            v_nous := v_nous + 1;
        END IF;

        -- El nom tal com surt al fitxer queda registrat com a àlies. Si ja hi
        -- constava (d'aquest jugador o d'un altre) no es toca res.
        INSERT INTO jugador_alies (jugador_id, alies, alies_norm, origen)
        VALUES (v_jugador_id, v_nom, normalitza_nom(v_nom), p_origen_alies)
        ON CONFLICT (alies_norm) DO NOTHING;
        IF FOUND THEN v_alies := v_alies + 1; END IF;

        INSERT INTO inscripcions (campionat_id, jugador_id)
        VALUES (p_campionat_id, v_jugador_id)
        ON CONFLICT DO NOTHING;

        v_correspon := v_correspon
            || jsonb_build_object(v_participant->>'local_id', v_jugador_id::TEXT);
    END LOOP;

    -- Val més plantar-se abans d'inserir que deixar que salti una violació de
    -- NOT NULL, que no diria de quin jugador es tracta.
    SELECT p->>'local_1' INTO v_desconegut
    FROM jsonb_array_elements(p_partides) AS p
    WHERE NOT (v_correspon ? (p->>'local_1'))
    LIMIT 1;
    IF v_desconegut IS NOT NULL THEN
        RAISE EXCEPTION 'Les partides citen el jugador local % , que no surt als participants',
            v_desconegut;
    END IF;

    SELECT p->>'local_2' INTO v_desconegut
    FROM jsonb_array_elements(p_partides) AS p
    WHERE p->>'local_2' IS NOT NULL AND NOT (v_correspon ? (p->>'local_2'))
    LIMIT 1;
    IF v_desconegut IS NOT NULL THEN
        RAISE EXCEPTION 'Les partides citen el jugador local % , que no surt als participants',
            v_desconegut;
    END IF;

    INSERT INTO partides (
        campionat_id, ronda, jugador_1_id, jugador_2_id, resultat_1, punts_1, punts_2,
        scrabbles_1, scrabbles_2,
        mot_1, punts_mot_1, mot_lletra_1, punts_lletra_1,
        mot_2, punts_mot_2, mot_lletra_2, punts_lletra_2
    )
    SELECT
        p_campionat_id,
        (p->>'ronda')::INTEGER,
        (v_correspon->>(p->>'local_1'))::UUID,
        (v_correspon->>(p->>'local_2'))::UUID,
        (p->>'resultat_1')::NUMERIC,
        (p->>'punts_1')::INTEGER,
        (p->>'punts_2')::INTEGER,
        (p->>'scrabbles_1')::INTEGER,
        (p->>'scrabbles_2')::INTEGER,
        NULLIF(p->>'mot_1', ''),
        (p->>'punts_mot_1')::INTEGER,
        NULLIF(p->>'mot_lletra_1', ''),
        (p->>'punts_lletra_1')::INTEGER,
        NULLIF(p->>'mot_2', ''),
        (p->>'punts_mot_2')::INTEGER,
        NULLIF(p->>'mot_lletra_2', ''),
        (p->>'punts_lletra_2')::INTEGER
    FROM jsonb_array_elements(p_partides) AS p
    WHERE p->>'local_2' IS NOT NULL;

    GET DIAGNOSTICS v_partides = ROW_COUNT;

    RETURN jsonb_build_object(
        'campionat_id', p_campionat_id,
        'participants', jsonb_array_length(p_participants),
        'jugadors_nous', v_nous,
        'alies_nous', v_alies,
        'partides', v_partides
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- Importació d'un campionat nou (mateixa signatura que abans)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION importa_campionat(
    p_campionat     JSONB,
    p_participants  JSONB,
    p_partides      JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_campionat_id  UUID;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden importar campionats';
    END IF;

    IF jsonb_array_length(p_participants) = 0 THEN
        RAISE EXCEPTION 'El campionat no té cap participant';
    END IF;

    INSERT INTO campionats (
        nom, data, temporada_codi, organitzador, club_organitzador_id,
        computa_barruf, motiu_no_computa, finalitzat,
        rondes_previstes, rondes_jugades, origen, notes, ordre
    )
    VALUES (
        p_campionat->>'nom',
        (p_campionat->>'data')::DATE,
        p_campionat->>'temporada_codi',
        NULLIF(p_campionat->>'organitzador', ''),
        (p_campionat->>'club_organitzador_id')::UUID,
        COALESCE((p_campionat->>'computa_barruf')::BOOLEAN, TRUE),
        NULLIF(p_campionat->>'motiu_no_computa', ''),
        COALESCE((p_campionat->>'finalitzat')::BOOLEAN, FALSE),
        (p_campionat->>'rondes_previstes')::INTEGER,
        (p_campionat->>'rondes_jugades')::INTEGER,
        NULLIF(p_campionat->>'origen', ''),
        NULLIF(p_campionat->>'notes', ''),
        COALESCE((p_campionat->>'ordre')::INTEGER, 0)
    )
    RETURNING id INTO v_campionat_id;

    RETURN desa_participants_i_partides(
        v_campionat_id, 'importació: ' || (p_campionat->>'nom'), p_participants, p_partides
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- Reimportació: substituir els participants i les partides d'un campionat
-- -----------------------------------------------------------------------------
/**
 * Torna a importar un campionat ja desat, per exemple perquè l'organitzador
 * ha corregit resultats o perquè ara tenim el fitxer amb les estadístiques.
 *
 * Les dades del campionat (nom, data, temporada, si computa…) no es toquen,
 * tret de les rondes jugades i l'origen, que són del fitxer. Les victòries
 * conegudes de l'arxiu (`inscripcions.victories`) desapareixen amb les
 * inscripcions: a partir d'ara es compten de les partides.
 *
 * El BARRUF no es recalcula aquí: ho fa la publicació, que ja es refia de les
 * partides que hi hagi.
 */
CREATE OR REPLACE FUNCTION reimporta_campionat(
    p_campionat_id  UUID,
    p_campionat     JSONB,
    p_participants  JSONB,
    p_partides      JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_nom       TEXT;
    v_anteriors INTEGER;
    v_resum     JSONB;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden importar campionats';
    END IF;

    SELECT nom INTO v_nom FROM campionats WHERE id = p_campionat_id FOR UPDATE;
    IF v_nom IS NULL THEN
        RAISE EXCEPTION 'No existeix el campionat %', p_campionat_id;
    END IF;

    DELETE FROM partides WHERE campionat_id = p_campionat_id;
    GET DIAGNOSTICS v_anteriors = ROW_COUNT;
    DELETE FROM inscripcions WHERE campionat_id = p_campionat_id;

    v_resum := desa_participants_i_partides(
        p_campionat_id, 'reimportació: ' || v_nom, p_participants, p_partides
    );

    UPDATE campionats SET
        rondes_jugades = COALESCE((p_campionat->>'rondes_jugades')::INTEGER, rondes_jugades),
        origen = COALESCE(NULLIF(p_campionat->>'origen', ''), origen),
        modificat_el = now()
    WHERE id = p_campionat_id;

    RETURN v_resum || jsonb_build_object('partides_anteriors', v_anteriors);
END;
$$;

REVOKE EXECUTE ON FUNCTION desa_participants_i_partides(UUID, TEXT, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION desa_participants_i_partides(UUID, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reimporta_campionat(UUID, JSONB, JSONB, JSONB) TO authenticated;

-- -----------------------------------------------------------------------------
-- Fitxa del campionat, amb les estadístiques
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fitxa_campionat(p_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH camp AS (
        SELECT c.*, club.nom AS club_organitzador
        FROM campionats c
        LEFT JOIN clubs club ON club.id = c.club_organitzador_id
        WHERE c.id = p_id
    ),
    edicio AS (
        SELECT e.id, e.numero FROM barruf_edicions e JOIN camp ON e.numero = camp.primera_edicio
    ),
    anterior AS (
        SELECT id FROM barruf_edicions
        WHERE numero < (SELECT numero FROM edicio) ORDER BY numero DESC LIMIT 1
    ),
    -- Cada partida des dels dos costats.
    costats AS (
        SELECT p.jugador_1_id AS jugador_id, p.resultat_1 AS resultat, p.punts_1 AS punts, p.punts_2 AS contra,
               p.scrabbles_1 AS scrabbles, p.mot_1 AS mot, p.punts_mot_1 AS punts_mot,
               p.mot_lletra_1 AS mot_lletra, p.punts_lletra_1 AS punts_lletra
        FROM partides p WHERE p.campionat_id = p_id AND p.jugador_2_id IS NOT NULL
        UNION ALL
        SELECT p.jugador_2_id, 1 - p.resultat_1, p.punts_2, p.punts_1,
               p.scrabbles_2, p.mot_2, p.punts_mot_2, p.mot_lletra_2, p.punts_lletra_2
        FROM partides p WHERE p.campionat_id = p_id AND p.jugador_2_id IS NOT NULL
    ),
    balanc AS (
        SELECT jugador_id,
               count(*)          AS partides,
               sum(resultat)     AS victories,
               sum(punts)        AS punts_favor,
               sum(contra)       AS punts_contra,
               max(punts)        AS millor_puntuacio,
               sum(scrabbles)    AS scrabbles
        FROM costats GROUP BY jugador_id
    ),
    millor_mot AS (
        SELECT DISTINCT ON (jugador_id) jugador_id, mot, punts_mot
        FROM costats WHERE punts_mot IS NOT NULL
        ORDER BY jugador_id, punts_mot DESC, mot
    ),
    millor_lletra AS (
        SELECT DISTINCT ON (jugador_id) jugador_id, mot_lletra, punts_lletra
        FROM costats WHERE punts_lletra IS NOT NULL
        ORDER BY jugador_id, punts_lletra DESC, mot_lletra
    )
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM camp) THEN NULL ELSE jsonb_build_object(
        'campionat', (SELECT jsonb_build_object(
            'id', id, 'nom', nom, 'data', data, 'temporada', temporada_codi,
            'organitzador', organitzador, 'club_organitzador', club_organitzador,
            'computa_barruf', computa_barruf, 'finalitzat', finalitzat,
            'barrufat', computa_barruf AND finalitzat,
            'rondes_jugades', rondes_jugades, 'rondes_previstes', rondes_previstes,
            'primera_edicio', primera_edicio
        ) FROM camp),
        'jugadors', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'numero', j.numero,
                'nom', j.nom_complet,
                'club', cl.nom,
                'partides', COALESCE(b.partides, 0),
                'victories', COALESCE(i.victories, b.victories, 0),
                'punts_favor', b.punts_favor,
                'punts_contra', b.punts_contra,
                'millor_puntuacio', b.millor_puntuacio,
                'scrabbles', b.scrabbles,
                'mot', mm.mot,
                'punts_mot', mm.punts_mot,
                'mot_lletra', ml.mot_lletra,
                'punts_lletra', ml.punts_lletra,
                'barruf_abans', va.barruf_abans,
                'barruf_despres', va.barruf_despres,
                'variacio', va.variacio,
                'esperanca', va.esperanca,
                'factor_k', va.factor_k,
                'posicio', ve.posicio,
                'posicio_anterior', vant.posicio,
                'estat', ve.estat
            )), '[]'::jsonb)
            FROM inscripcions i
            JOIN jugadors j ON j.id = i.jugador_id
            LEFT JOIN clubs cl ON cl.id = j.club_id
            LEFT JOIN balanc b ON b.jugador_id = i.jugador_id
            LEFT JOIN millor_mot mm ON mm.jugador_id = i.jugador_id
            LEFT JOIN millor_lletra ml ON ml.jugador_id = i.jugador_id
            LEFT JOIN barruf_variacions va ON va.campionat_id = p_id AND va.jugador_id = i.jugador_id
            LEFT JOIN barruf_valors ve ON ve.jugador_id = i.jugador_id AND ve.edicio_id = (SELECT id FROM edicio)
            LEFT JOIN barruf_valors vant ON vant.jugador_id = i.jugador_id AND vant.edicio_id = (SELECT id FROM anterior)
            WHERE i.campionat_id = p_id
        ),
        'partides', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', p.id,
                'ronda', p.ronda,
                'numero_1', j1.numero, 'jugador_1', j1.nom_complet,
                'numero_2', j2.numero, 'jugador_2', j2.nom_complet,
                'resultat_1', p.resultat_1,
                'punts_1', p.punts_1, 'punts_2', p.punts_2,
                'scrabbles_1', p.scrabbles_1, 'scrabbles_2', p.scrabbles_2,
                'mot_1', p.mot_1, 'punts_mot_1', p.punts_mot_1,
                'mot_lletra_1', p.mot_lletra_1, 'punts_lletra_1', p.punts_lletra_1,
                'mot_2', p.mot_2, 'punts_mot_2', p.punts_mot_2,
                'mot_lletra_2', p.mot_lletra_2, 'punts_lletra_2', p.punts_lletra_2
            ) ORDER BY p.ronda, j1.nom_complet), '[]'::jsonb)
            FROM partides p
            JOIN jugadors j1 ON j1.id = p.jugador_1_id
            LEFT JOIN jugadors j2 ON j2.id = p.jugador_2_id
            WHERE p.campionat_id = p_id
        )
    ) END;
$$;
