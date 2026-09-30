-- =============================================================================
-- L'arxiu: edicions i campionats anteriors a la llavor
-- =============================================================================
-- Les edicions de la 70 a la 189 (temporades 2014-15 a 2024-25) es desen tal
-- com les va publicar l'AJUSC, amb els seus campionats. No entren a la cadena
-- que es rejuga: aquesta arrenca de la llavor (la 190) i ja està verificada
-- edició per edició. Si algun dia es corregeix un resultat d'aquells anys, el
-- BARRUF d'aleshores no es recalcula: es queda com es va publicar.
--
-- Dels campionats d'abans del 2018-19 només es conserven els aparellaments i
-- les victòries totals de cada jugador, no qui va guanyar cada partida.
-- =============================================================================

-- Resultat desconegut: la partida es va jugar, però no se sap qui la va guanyar.
ALTER TABLE partides ALTER COLUMN resultat_1 DROP NOT NULL;
ALTER TABLE partides DROP CONSTRAINT IF EXISTS partides_resultat_1_check;
ALTER TABLE partides ADD CONSTRAINT partides_resultat_1_check
    CHECK (resultat_1 IS NULL OR resultat_1 IN (0, 0.5, 1));

COMMENT ON COLUMN partides.resultat_1 IS
    'Resultat del jugador 1 (1, 0,5 o 0). NULL si no se sap: campionats antics dels quals només hi ha els aparellaments.';

-- Victòries totals d'un jugador en un campionat, quan no se sap el resultat de
-- cada partida. És el que en guardava el full de l'AJUSC fins al 2018.
ALTER TABLE inscripcions ADD COLUMN victories NUMERIC(5,1);

COMMENT ON COLUMN inscripcions.victories IS
    'Victòries totals al campionat, quan no es coneix el resultat de cada partida.';

-- -----------------------------------------------------------------------------
-- La cadena només rejuga el que ve després de la llavor
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dades_per_recalcular()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    WITH llavor AS (SELECT id, numero FROM barruf_edicions WHERE es_llavor)
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
            JOIN llavor ON llavor.id = v.edicio_id
            JOIN jugadors j ON j.id = v.jugador_id
        ),
        'ultima_edicio', (SELECT COALESCE(max(numero), 0) FROM barruf_edicions),
        'campionats', (
            SELECT COALESCE(jsonb_agg(c ORDER BY c.primera_edicio NULLS LAST, c.data, c.ordre), '[]'::jsonb)
            FROM (
                SELECT
                    camp.id,
                    camp.nom,
                    camp.data,
                    camp.ordre,
                    camp.primera_edicio,
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
                  -- Els campionats de l'arxiu ja són dins de la llavor.
                  AND (camp.primera_edicio IS NULL
                       OR camp.primera_edicio > (SELECT numero FROM llavor))
            ) AS c
        )
    );
$$;

-- -----------------------------------------------------------------------------
-- Fitxa del campionat: les victòries totals quan no hi ha el resultat de cada partida
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
                'victories', COALESCE(i.victories, b.victories, 0),
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
