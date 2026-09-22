-- =============================================================================
-- Importació d'un campionat
-- =============================================================================
-- Tot en una sola funció perquè sigui atòmic. Amb una tanda de crides soltes,
-- una fallada a mig camí deixaria el campionat creat, la meitat de les partides
-- desades i cap manera de saber per on s'havia quedat.
--
-- Les funcions són SECURITY INVOKER (el valor per defecte): s'executen amb els
-- permisos de qui les crida, de manera que l'RLS continua manant.
-- =============================================================================

/**
 * Forma canònica d'un nom, amb les mateixes regles que `normalitzaNom` de
 * `lib/importacio/noms.ts`.
 *
 * Cal tenir-la també aquí perquè els àlies els escriu la base de dades. Si es
 * canvien les regles, s'han de canviar als dos llocs i regenerar els àlies.
 * `lib/importacio/normalitzacio.test.ts` comprova que les dues coincideixen.
 */
CREATE OR REPLACE FUNCTION normalitza_nom(nom TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT lower(btrim(regexp_replace(
        regexp_replace(
            -- Diacrítics fora, un cop descompost el text.
            regexp_replace(
                normalize(
                    -- Apòstrofs tipogràfics al recte i punt volat fora.
                    replace(replace(replace(
                        -- Espais que no ho semblen, a espai normal.
                        regexp_replace(
                            -- Caràcters de format invisibles, fora.
                            regexp_replace(
                                nom,
                                '[­​‌‍‎‏⁠⁡⁢⁣⁤﻿]',
                                '', 'g'
                            ),
                            '[   -   　]', ' ', 'g'
                        ),
                        '·', ''), '‘', ''''), '’', ''''),
                    NFD
                ),
                '[̀-ͯ]', '', 'g'
            ),
            '\s+', ' ', 'g'
        ),
        '\s+', ' ', 'g'
    )));
$$;

/**
 * Importa un campionat sencer.
 *
 * `p_participants` és un array d'objectes:
 *   { local_id, nom, jugador_numero }
 * on `jugador_numero` és el del registre si el gestor l'ha associat, o null si
 * és una alta nova. El nom es desa sempre com a àlies, de manera que la propera
 * importació d'aquell club el reconegui tot sol.
 *
 * `p_partides` és un array d'objectes:
 *   { ronda, local_1, local_2, resultat_1, punts_1, punts_2 }
 * amb `local_2` a null per als descansos, que no es desen.
 */
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

    -- ---------------------------------------------------------------------
    -- Participants: associar-los al registre o donar-los d'alta
    -- ---------------------------------------------------------------------
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
        VALUES (v_jugador_id, v_nom, normalitza_nom(v_nom),
                'importació: ' || (p_campionat->>'nom'))
        ON CONFLICT (alies_norm) DO NOTHING;
        IF FOUND THEN v_alies := v_alies + 1; END IF;

        INSERT INTO inscripcions (campionat_id, jugador_id)
        VALUES (v_campionat_id, v_jugador_id)
        ON CONFLICT DO NOTHING;

        v_correspon := v_correspon
            || jsonb_build_object(v_participant->>'local_id', v_jugador_id::TEXT);
    END LOOP;

    -- ---------------------------------------------------------------------
    -- Partides
    -- ---------------------------------------------------------------------
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
        campionat_id, ronda, jugador_1_id, jugador_2_id, resultat_1, punts_1, punts_2
    )
    SELECT
        v_campionat_id,
        (p->>'ronda')::INTEGER,
        (v_correspon->>(p->>'local_1'))::UUID,
        (v_correspon->>(p->>'local_2'))::UUID,
        (p->>'resultat_1')::NUMERIC,
        (p->>'punts_1')::INTEGER,
        (p->>'punts_2')::INTEGER
    FROM jsonb_array_elements(p_partides) AS p
    WHERE p->>'local_2' IS NOT NULL;

    GET DIAGNOSTICS v_partides = ROW_COUNT;

    RETURN jsonb_build_object(
        'campionat_id', v_campionat_id,
        'participants', jsonb_array_length(p_participants),
        'jugadors_nous', v_nous,
        'alies_nous', v_alies,
        'partides', v_partides
    );
END;
$$;

GRANT EXECUTE ON FUNCTION normalitza_nom(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION importa_campionat(JSONB, JSONB, JSONB) TO authenticated;
