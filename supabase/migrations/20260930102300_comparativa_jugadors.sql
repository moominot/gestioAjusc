-- =============================================================================
-- Comparar jugadors
-- =============================================================================
-- Tot el que cal per comparar de 2 a 8 jugadors: l'estat de cadascun a l'última
-- edició, les estadístiques de jugades, l'evolució del BARRUF edició a edició,
-- els cara a cara entre ells i els rivals que tenen en comú. Les prediccions
-- les fa l'aplicació amb la mateixa fórmula del BARRUF.
-- Públic: tot ve de dades que ja es publiquen.
-- =============================================================================

CREATE OR REPLACE FUNCTION comparativa_jugadors(p_numeros INTEGER[])
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH triats AS (
        SELECT j.id, j.numero, j.nom_complet, cl.nom AS club
        FROM jugadors j LEFT JOIN clubs cl ON cl.id = j.club_id
        WHERE j.numero = ANY (p_numeros[1:8]) AND j.fusionat_a IS NULL
    ),
    ultima AS (SELECT id, numero FROM barruf_edicions ORDER BY numero DESC LIMIT 1),
    -- Cada partida, des del costat de cada jugador triat.
    costats AS (
        SELECT t.numero, p.campionat_id, p.ronda, p.jugador_2_id AS rival_id, p.resultat_1 AS resultat,
               p.punts_1 AS punts, p.punts_2 AS punts_rival, p.scrabbles_1 AS scrabbles,
               p.mot_1 AS mot, p.punts_mot_1 AS punts_mot
        FROM partides p JOIN triats t ON t.id = p.jugador_1_id WHERE p.jugador_2_id IS NOT NULL
        UNION ALL
        SELECT t.numero, p.campionat_id, p.ronda, p.jugador_1_id, 1 - p.resultat_1,
               p.punts_2, p.punts_1, p.scrabbles_2, p.mot_2, p.punts_mot_2
        FROM partides p JOIN triats t ON t.id = p.jugador_2_id
    ),
    -- Balanç de cada triat contra cada rival.
    contra AS (
        SELECT c.numero, r.numero AS rival, r.nom_complet AS rival_nom,
               count(*) AS partides,
               count(*) FILTER (WHERE c.resultat IS NOT NULL) AS amb_resultat,
               sum(c.resultat) AS victories
        FROM costats c JOIN jugadors r ON r.id = c.rival_id
        GROUP BY c.numero, r.numero, r.nom_complet
    )
    SELECT jsonb_build_object(
        'edicio', (SELECT numero FROM ultima),
        'jugadors', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'numero', t.numero, 'nom', t.nom_complet, 'club', t.club,
                'barruf', v.barruf, 'estat', v.estat, 'posicio', v.posicio,
                'partides_totals', v.partides_totals, 'victories_totals', v.victories_totals,
                'partides_temporada', v.partides_temporada, 'victories_temporada', v.victories_temporada,
                'darrera_temporada', v.darrera_temporada,
                'scrabbles', (SELECT sum(scrabbles) FROM costats c WHERE c.numero = t.numero),
                'partides_scrabbles', (SELECT count(*) FROM costats c WHERE c.numero = t.numero AND c.scrabbles IS NOT NULL),
                'punts_mitjans', (SELECT round(avg(punts)) FROM costats c WHERE c.numero = t.numero AND c.punts IS NOT NULL),
                'millor_jugada', (
                    SELECT jsonb_build_object('mot', mot, 'punts', punts_mot)
                    FROM costats c WHERE c.numero = t.numero AND c.punts_mot IS NOT NULL
                    ORDER BY c.punts_mot DESC LIMIT 1
                )
            ) ORDER BY array_position(p_numeros, t.numero)), '[]'::jsonb)
            FROM triats t
            LEFT JOIN barruf_valors v ON v.jugador_id = t.id AND v.edicio_id = (SELECT id FROM ultima)
        ),
        -- El BARRUF de cada jugador a cada edició on surt.
        'evolucio', (
            SELECT COALESCE(jsonb_object_agg(numero, punts), '{}'::jsonb)
            FROM (
                SELECT t.numero, jsonb_agg(jsonb_build_array(e.numero, round(v.barruf)) ORDER BY e.numero) AS punts
                FROM triats t
                JOIN barruf_valors v ON v.jugador_id = t.id
                JOIN barruf_edicions e ON e.id = v.edicio_id
                WHERE v.partides_totals > 0
                GROUP BY t.numero
            ) x
        ),
        -- Entre cada parella de triats.
        'parelles', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'a', a.numero, 'b', b.numero,
                'cara_a_cara', (
                    SELECT jsonb_build_object(
                        'partides', count(*),
                        'amb_resultat', count(*) FILTER (WHERE c.resultat IS NOT NULL),
                        'victories_a', sum(c.resultat),
                        'darreres', (
                            SELECT COALESCE(jsonb_agg(x ORDER BY x.data DESC), '[]'::jsonb) FROM (
                                SELECT k.nom AS campionat, k.id AS campionat_id, k.data, c2.ronda,
                                       c2.resultat, c2.punts, c2.punts_rival
                                FROM costats c2 JOIN campionats k ON k.id = c2.campionat_id
                                WHERE c2.numero = a.numero AND c2.rival_id = b.id
                                ORDER BY k.primera_edicio DESC NULLS FIRST, k.data DESC, c2.ronda DESC
                                LIMIT 6
                            ) x
                        )
                    )
                    FROM costats c WHERE c.numero = a.numero AND c.rival_id = b.id
                ),
                'rivals_comuns', (
                    SELECT jsonb_build_object(
                        'rivals', count(*),
                        'partides_a', COALESCE(sum(ca.amb_resultat), 0),
                        'victories_a', COALESCE(sum(ca.victories), 0),
                        'partides_b', COALESCE(sum(cb.amb_resultat), 0),
                        'victories_b', COALESCE(sum(cb.victories), 0),
                        'detall', (
                            SELECT COALESCE(jsonb_agg(y ORDER BY y.total DESC), '[]'::jsonb) FROM (
                                SELECT ca2.rival_nom AS rival, ca2.rival AS numero,
                                       ca2.amb_resultat AS partides_a, ca2.victories AS victories_a,
                                       cb2.amb_resultat AS partides_b, cb2.victories AS victories_b,
                                       ca2.amb_resultat + cb2.amb_resultat AS total
                                FROM contra ca2 JOIN contra cb2 ON cb2.rival = ca2.rival AND cb2.numero = b.numero
                                WHERE ca2.numero = a.numero AND ca2.rival NOT IN (a.numero, b.numero)
                                  AND ca2.amb_resultat > 0 AND cb2.amb_resultat > 0
                                ORDER BY ca2.amb_resultat + cb2.amb_resultat DESC
                                LIMIT 8
                            ) y
                        )
                    )
                    FROM contra ca JOIN contra cb ON cb.rival = ca.rival AND cb.numero = b.numero
                    WHERE ca.numero = a.numero AND ca.rival NOT IN (a.numero, b.numero)
                      AND ca.amb_resultat > 0 AND cb.amb_resultat > 0
                )
            ) ORDER BY array_position(p_numeros, a.numero), array_position(p_numeros, b.numero)), '[]'::jsonb)
            FROM triats a JOIN triats b
              ON array_position(p_numeros, a.numero) < array_position(p_numeros, b.numero)
        )
    );
$$;

GRANT EXECUTE ON FUNCTION comparativa_jugadors(INTEGER[]) TO anon, authenticated;
