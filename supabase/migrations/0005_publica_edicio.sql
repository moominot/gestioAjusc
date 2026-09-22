-- =============================================================================
-- Publicació d'una edició del BARRUF
-- =============================================================================
-- El càlcul el fa el motor en TypeScript (lib/barruf/publicacio.ts); aquí només
-- es desa, i també en una sola operació perquè una edició a mig escriure seria
-- pitjor que no tenir-ne cap.
-- =============================================================================

/**
 * Desa una edició nova del BARRUF.
 *
 * `p_valors` és un array de:
 *   { jugador_numero, barruf, partides_totals, victories_totals,
 *     partides_temporada, victories_temporada, estat, darrera_temporada,
 *     cohort_llegat, posicio, debutant }
 *
 * `p_variacions` és un array de:
 *   { campionat_id, jugador_numero, barruf_abans, partides, victories,
 *     esperanca, factor_k, variacio, barruf_despres }
 *
 * Les variacions es reescriuen senceres. Són una projecció del càlcul, no un
 * registre històric: si es corregeix un resultat antic i es torna a publicar,
 * les d'abans deixen de ser certes. Les EDICIONS, en canvi, no es toquen mai:
 * són el que es va publicar en el seu moment.
 */
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

    INSERT INTO barruf_edicions (numero, data_publicacio, temporada_codi, descripcio)
    VALUES (
        v_numero,
        COALESCE((p_edicio->>'data_publicacio')::DATE, CURRENT_DATE),
        p_edicio->>'temporada_codi',
        NULLIF(p_edicio->>'descripcio', '')
    )
    RETURNING id INTO v_edicio_id;

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

    -- Les variacions es refan senceres a cada publicació.
    DELETE FROM barruf_variacions;

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

GRANT EXECUTE ON FUNCTION publica_edicio(JSONB, JSONB, JSONB) TO authenticated;

/**
 * Tot el que el motor necessita per rejugar la cadena, en una sola consulta.
 *
 * Retorna la llavor (l'edició marcada com a tal), els campionats que entren a
 * la cadena ja ordenats, i les seves partides i inscripcions.
 */
CREATE OR REPLACE FUNCTION dades_per_recalcular()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'llavor', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'jugador_numero', j.numero,
                'barruf', v.barruf,
                'partides_totals', v.partides_totals,
                'victories_totals', v.victories_totals,
                'partides_temporada', v.partides_temporada,
                'victories_temporada', v.victories_temporada,
                'darrera_temporada', v.darrera_temporada,
                'cohort_llegat', v.cohort_llegat
            )), '[]'::jsonb)
            FROM barruf_valors v
            JOIN barruf_edicions e ON e.id = v.edicio_id AND e.es_llavor
            JOIN jugadors j ON j.id = v.jugador_id
        ),
        'ultima_edicio', (SELECT COALESCE(max(numero), 0) FROM barruf_edicions),
        'campionats', (
            SELECT COALESCE(jsonb_agg(c ORDER BY c.data, c.ordre), '[]'::jsonb)
            FROM (
                SELECT
                    camp.id,
                    camp.nom,
                    camp.data,
                    camp.ordre,
                    camp.temporada_codi,
                    (SELECT COALESCE(jsonb_agg(j.numero), '[]'::jsonb)
                     FROM inscripcions i JOIN jugadors j ON j.id = i.jugador_id
                     WHERE i.campionat_id = camp.id) AS inscrits,
                    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'ronda', p.ronda,
                        'jugador_1', j1.numero,
                        'jugador_2', j2.numero,
                        'resultat_1', p.resultat_1
                     )), '[]'::jsonb)
                     FROM partides p
                     JOIN jugadors j1 ON j1.id = p.jugador_1_id
                     LEFT JOIN jugadors j2 ON j2.id = p.jugador_2_id
                     WHERE p.campionat_id = camp.id) AS partides
                FROM campionats camp
                WHERE camp.computa_barruf AND camp.finalitzat
            ) AS c
        )
    );
$$;

GRANT EXECUTE ON FUNCTION dades_per_recalcular() TO authenticated;
