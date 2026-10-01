-- =============================================================================
-- Publicar no ha d'esborrar les variacions de l'arxiu
-- =============================================================================
-- `publica_edicio` esborrava TOTES les variacions per campionat abans de desar
-- les noves. Però el motor només rejuga els campionats posteriors a la llavor:
-- les variacions dels campionats de l'arxiu (2014-2025), que són les que fan
-- l'evolució de cada jugador, haurien desaparegut a la primera publicació.
-- Ara només s'esborren les dels campionats que es recalculen.
-- =============================================================================

CREATE OR REPLACE FUNCTION publica_edicio(
    p_edicio      JSONB,
    p_valors      JSONB,
    p_variacions  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_edicio_id  UUID;
    v_numero     INTEGER;
    v_valors     INTEGER;
    v_variacions INTEGER;
    v_orfe       TEXT;
    v_anterior   barruf_edicions%ROWTYPE;
    v_noms       TEXT;
    v_nous       INTEGER;
    v_resultats  INTEGER;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden publicar el BARRUF';
    END IF;

    v_numero := (p_edicio->>'numero')::INTEGER;
    IF v_numero IS NULL THEN
        RAISE EXCEPTION 'L''edició necessita un número';
    END IF;

    IF EXISTS (SELECT 1 FROM barruf_edicions WHERE numero = v_numero) THEN
        RAISE EXCEPTION 'El BARRUF % ja està publicat', v_numero;
    END IF;

    -- Cap número pot anar enrere: la cadena és una successió.
    IF v_numero <= (SELECT COALESCE(max(numero), 0) FROM barruf_edicions) THEN
        RAISE EXCEPTION 'El BARRUF % és anterior a l''última edició publicada', v_numero;
    END IF;

    SELECT v->>'jugador_numero' INTO v_orfe
    FROM jsonb_array_elements(p_valors) AS v
    WHERE NOT EXISTS (
        SELECT 1 FROM jugadors j WHERE j.numero = (v->>'jugador_numero')::INTEGER
    )
    LIMIT 1;
    IF v_orfe IS NOT NULL THEN
        RAISE EXCEPTION 'No existeix cap jugador amb el número %', v_orfe;
    END IF;

    -- Els campionats de la cadena que cap edició no havia computat encara.
    SELECT
        string_agg(c.nom, ', ' ORDER BY c.data, c.ordre),
        count(*),
        COALESCE(sum((
            SELECT count(*) FROM partides p
            WHERE p.campionat_id = c.id AND p.jugador_2_id IS NOT NULL
        )), 0) * 2
    INTO v_noms, v_nous, v_resultats
    FROM campionats c
    WHERE c.computa_barruf AND c.finalitzat AND c.primera_edicio IS NULL;

    SELECT * INTO v_anterior FROM barruf_edicions ORDER BY numero DESC LIMIT 1;

    INSERT INTO barruf_edicions (
        numero, data_publicacio, temporada_codi, descripcio,
        campionats_computats, resultats_acumulats, campionats_acumulats
    )
    VALUES (
        v_numero,
        COALESCE((p_edicio->>'data_publicacio')::DATE, CURRENT_DATE),
        p_edicio->>'temporada_codi',
        NULLIF(p_edicio->>'descripcio', ''),
        v_noms,
        v_anterior.resultats_acumulats + v_resultats,
        v_anterior.campionats_acumulats + v_nous
    )
    RETURNING id INTO v_edicio_id;

    UPDATE campionats SET primera_edicio = v_numero
    WHERE computa_barruf AND finalitzat AND primera_edicio IS NULL;

    INSERT INTO barruf_valors (
        edicio_id, jugador_id, barruf,
        partides_totals, victories_totals, partides_temporada, victories_temporada,
        estat, darrera_temporada, cohort_llegat, debutant, posicio
    )
    SELECT
        v_edicio_id,
        j.id,
        (v->>'barruf')::NUMERIC,
        (v->>'partides_totals')::INTEGER,
        (v->>'victories_totals')::NUMERIC,
        (v->>'partides_temporada')::INTEGER,
        (v->>'victories_temporada')::NUMERIC,
        (v->>'estat')::estat_jugador,
        v->>'darrera_temporada',
        COALESCE((v->>'cohort_llegat')::BOOLEAN, FALSE),
        COALESCE((v->>'debutant')::BOOLEAN, FALSE),
        (v->>'posicio')::INTEGER
    FROM jsonb_array_elements(p_valors) AS v
    JOIN jugadors j ON j.numero = (v->>'jugador_numero')::INTEGER;

    GET DIAGNOSTICS v_valors = ROW_COUNT;

    -- Les variacions dels campionats de la cadena es refan senceres; les dels
    -- campionats de l'arxiu (fins a la llavor) no es toquen: el motor no els rejuga.
    DELETE FROM barruf_variacions
    WHERE campionat_id IN (
        SELECT id FROM campionats
        WHERE primera_edicio IS NULL
           OR primera_edicio > (SELECT numero FROM barruf_edicions WHERE es_llavor)
    );

    INSERT INTO barruf_variacions (
        campionat_id, jugador_id, barruf_abans, partides, victories,
        esperanca, factor_k, variacio, barruf_despres
    )
    SELECT
        (v->>'campionat_id')::UUID,
        j.id,
        (v->>'barruf_abans')::NUMERIC,
        (v->>'partides')::INTEGER,
        (v->>'victories')::NUMERIC,
        (v->>'esperanca')::NUMERIC,
        (v->>'factor_k')::INTEGER,
        (v->>'variacio')::NUMERIC,
        (v->>'barruf_despres')::NUMERIC
    FROM jsonb_array_elements(p_variacions) AS v
    JOIN jugadors j ON j.numero = (v->>'jugador_numero')::INTEGER;

    GET DIAGNOSTICS v_variacions = ROW_COUNT;

    RETURN jsonb_build_object(
        'edicio_id', v_edicio_id,
        'numero', v_numero,
        'valors', v_valors,
        'variacions', v_variacions
    );
END;
$$;
