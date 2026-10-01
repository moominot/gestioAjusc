-- =============================================================================
-- Millors jugades d'un jugador
-- =============================================================================
-- De les partides que en tenen les dades: les millors jugades, les millors amb
-- lletra especial, i els scrabbles (total i rècord en una partida). Públic, com
-- la resta de dades de les partides.
-- =============================================================================

CREATE OR REPLACE FUNCTION jugades_jugador(p_numero INTEGER)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH jo AS (SELECT id FROM jugadors WHERE numero = p_numero AND fusionat_a IS NULL),
    costats AS (
        SELECT p.campionat_id, p.ronda, p.jugador_2_id AS rival_id,
               p.scrabbles_1 AS scrabbles, p.mot_1 AS mot, p.punts_mot_1 AS punts_mot,
               p.mot_lletra_1 AS mot_lletra, p.punts_lletra_1 AS punts_lletra
        FROM partides p WHERE p.jugador_1_id = (SELECT id FROM jo) AND p.jugador_2_id IS NOT NULL
        UNION ALL
        SELECT p.campionat_id, p.ronda, p.jugador_1_id,
               p.scrabbles_2, p.mot_2, p.punts_mot_2, p.mot_lletra_2, p.punts_lletra_2
        FROM partides p WHERE p.jugador_2_id = (SELECT id FROM jo)
    ),
    amb AS (
        SELECT c.*, k.nom AS campionat, k.data, r.nom_complet AS rival, r.numero AS rival_numero
        FROM costats c
        JOIN campionats k ON k.id = c.campionat_id
        JOIN jugadors r ON r.id = c.rival_id
    )
    SELECT jsonb_build_object(
        'millors', (
            SELECT COALESCE(jsonb_agg(x ORDER BY x.punts DESC, x.data DESC), '[]'::jsonb) FROM (
                SELECT mot, punts_mot AS punts, campionat, campionat_id, data, ronda, rival, rival_numero
                FROM amb WHERE punts_mot IS NOT NULL ORDER BY punts_mot DESC, data DESC LIMIT 5
            ) x
        ),
        'lletra', (
            SELECT COALESCE(jsonb_agg(x ORDER BY x.punts DESC, x.data DESC), '[]'::jsonb) FROM (
                SELECT mot_lletra AS mot, punts_lletra AS punts, campionat, campionat_id, data, ronda, rival, rival_numero
                FROM amb WHERE punts_lletra IS NOT NULL ORDER BY punts_lletra DESC, data DESC LIMIT 5
            ) x
        ),
        'scrabbles', (
            SELECT jsonb_build_object(
                'total', COALESCE(sum(scrabbles), 0),
                'partides', count(*),
                'record', max(scrabbles)
            ) FROM amb WHERE scrabbles IS NOT NULL
        ),
        'record_scrabbles', (
            SELECT jsonb_build_object('scrabbles', scrabbles, 'campionat', campionat, 'campionat_id', campionat_id,
                                      'ronda', ronda, 'rival', rival, 'data', data)
            FROM amb WHERE scrabbles IS NOT NULL ORDER BY scrabbles DESC, data DESC LIMIT 1
        )
    );
$$;

GRANT EXECUTE ON FUNCTION jugades_jugador(INTEGER) TO anon, authenticated;
