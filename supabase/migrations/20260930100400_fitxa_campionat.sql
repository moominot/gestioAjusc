-- =============================================================================
-- La fitxa de cada campionat, i la classificació amb la variació
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Llista de campionats: amb l'edició que el va computar, i en l'ordre de la
-- cadena (el més recent primer), que no sempre és el de les dates.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW campionats_publics
WITH (security_invoker = false) AS
    SELECT
        camp.id,
        camp.nom,
        camp.data,
        camp.temporada_codi,
        camp.organitzador,
        club.nom                AS club_organitzador,
        camp.computa_barruf,
        camp.finalitzat,
        (camp.computa_barruf AND camp.finalitzat) AS barrufat,
        camp.rondes_previstes,
        camp.rondes_jugades,
        (SELECT count(*) FROM inscripcions i WHERE i.campionat_id = camp.id) AS participants,
        (SELECT count(*) FROM partides p WHERE p.campionat_id = camp.id)     AS partides,
        camp.primera_edicio
    FROM campionats camp
    LEFT JOIN clubs club ON club.id = camp.club_organitzador_id
    ORDER BY camp.primera_edicio DESC NULLS FIRST, camp.data DESC, camp.ordre DESC;

-- -----------------------------------------------------------------------------
-- Classificació: el mateix d'abans i, al final, com estava a l'edició anterior
-- i què ha jugat des d'aleshores. És el que permet posar-hi la fletxa.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW barruf_classificacio
WITH (security_invoker = false) AS
    SELECT
        e.numero                AS edicio,
        e.data_publicacio,
        v.posicio,
        j.numero                AS jugador_numero,
        j.nom_complet,
        c.nom                   AS club,
        v.barruf,
        categoria_barruf(v.barruf) AS categoria,
        v.estat,
        v.partides_totals,
        v.victories_totals,
        v.partides_temporada,
        v.victories_temporada,
        v.darrera_temporada,
        v.debutant,
        a.posicio               AS posicio_anterior,
        a.barruf                AS barruf_anterior,
        v.partides_totals - COALESCE(a.partides_totals, 0)   AS partides_edicio,
        v.victories_totals - COALESCE(a.victories_totals, 0) AS victories_edicio
    FROM barruf_valors v
    JOIN barruf_ultima_edicio e ON e.id = v.edicio_id
    JOIN jugadors j ON j.id = v.jugador_id
    LEFT JOIN clubs c ON c.id = j.club_id
    LEFT JOIN barruf_valors a
        ON a.jugador_id = v.jugador_id
       AND a.edicio_id = (
            SELECT id FROM barruf_edicions WHERE numero < e.numero ORDER BY numero DESC LIMIT 1
       )
    WHERE j.fusionat_a IS NULL;

-- -----------------------------------------------------------------------------
-- La fitxa d'un campionat
-- -----------------------------------------------------------------------------
/**
 * Tot el que ensenya la pàgina d'un campionat, en una sola consulta: les
 * dades, les partides i, per jugador, el balanç del campionat i el que li va
 * fer al BARRUF.
 *
 * Com les vistes públiques, s'executa amb els permisos del propietari i només
 * retorna el que ja és públic.
 */
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
        SELECT p.jugador_1_id AS jugador_id, p.resultat_1 AS resultat, p.punts_1 AS punts, p.punts_2 AS contra
        FROM partides p WHERE p.campionat_id = p_id AND p.jugador_2_id IS NOT NULL
        UNION ALL
        SELECT p.jugador_2_id, 1 - p.resultat_1, p.punts_2, p.punts_1
        FROM partides p WHERE p.campionat_id = p_id AND p.jugador_2_id IS NOT NULL
    ),
    balanc AS (
        SELECT jugador_id,
               count(*)          AS partides,
               sum(resultat)     AS victories,
               sum(punts)        AS punts_favor,
               sum(contra)       AS punts_contra,
               max(punts)        AS millor_puntuacio
        FROM costats GROUP BY jugador_id
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
                'victories', COALESCE(b.victories, 0),
                'punts_favor', b.punts_favor,
                'punts_contra', b.punts_contra,
                'millor_puntuacio', b.millor_puntuacio,
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
                'punts_1', p.punts_1, 'punts_2', p.punts_2
            ) ORDER BY p.ronda, j1.nom_complet), '[]'::jsonb)
            FROM partides p
            JOIN jugadors j1 ON j1.id = p.jugador_1_id
            LEFT JOIN jugadors j2 ON j2.id = p.jugador_2_id
            WHERE p.campionat_id = p_id
        )
    ) END;
$$;

GRANT EXECUTE ON FUNCTION fitxa_campionat(UUID) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enfrontaments amb la temporada, per poder-los filtrar a la fitxa del jugador
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW enfrontaments
WITH (security_invoker = false) AS
    SELECT
        jo.numero               AS jugador_numero,
        rival.numero            AS rival_numero,
        rival.nom_complet       AS rival,
        p.campionat_id,
        camp.nom                AS campionat,
        camp.data,
        p.ronda,
        d.resultat,
        d.punts,
        d.punts_rival,
        camp.temporada_codi
    FROM partides p
    JOIN campionats camp ON camp.id = p.campionat_id
    CROSS JOIN LATERAL (
        VALUES
            (p.jugador_1_id, p.jugador_2_id, p.resultat_1, p.punts_1, p.punts_2),
            (p.jugador_2_id, p.jugador_1_id, 1 - p.resultat_1, p.punts_2, p.punts_1)
    ) AS d(jugador_id, rival_id, resultat, punts, punts_rival)
    JOIN jugadors jo ON jo.id = d.jugador_id
    JOIN jugadors rival ON rival.id = d.rival_id
    WHERE p.jugador_2_id IS NOT NULL;
