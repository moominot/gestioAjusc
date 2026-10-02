-- =============================================================================
-- Estadístiques històriques
-- =============================================================================
-- Una base comuna per a totes les consultes: `fets_partida`, una fila per
-- jugador i partida, amb tot el que s'hi pot filtrar o sumar. Les consultes
-- en surten amb els mateixos filtres:
--   { des_de, fins_a }  temporades, p. ex. "2018-19"
--   club                nom curt del club (l'actual del jugador)
--   campionat           id del campionat
--   jugador             número del jugador
--   minim               partides mínimes per als percentatges i mitjanes
-- Públic: tot ve de dades que ja es publiquen.
-- =============================================================================

CREATE OR REPLACE VIEW fets_partida
WITH (security_invoker = false) AS
    SELECT
        p.id                AS partida_id,
        c.id                AS campionat_id,
        c.nom               AS campionat,
        c.temporada_codi    AS temporada,
        c.primera_edicio    AS edicio,
        c.data,
        p.ronda,
        j.id                AS jugador_id,
        j.numero,
        j.nom_complet       AS nom,
        jc.nom              AS club,
        r.numero            AS rival_numero,
        r.nom_complet       AS rival,
        rc.nom              AS rival_club,
        d.resultat,
        d.punts,
        d.punts_rival,
        d.scrabbles,
        d.mot,
        d.punts_mot,
        d.mot_lletra,
        d.punts_lletra
    FROM partides p
    JOIN campionats c ON c.id = p.campionat_id
    CROSS JOIN LATERAL (VALUES
        (p.jugador_1_id, p.jugador_2_id, p.resultat_1, p.punts_1, p.punts_2, p.scrabbles_1,
         p.mot_1, p.punts_mot_1, p.mot_lletra_1, p.punts_lletra_1),
        (p.jugador_2_id, p.jugador_1_id, 1 - p.resultat_1, p.punts_2, p.punts_1, p.scrabbles_2,
         p.mot_2, p.punts_mot_2, p.mot_lletra_2, p.punts_lletra_2)
    ) AS d(jugador_id, rival_id, resultat, punts, punts_rival, scrabbles, mot, punts_mot, mot_lletra, punts_lletra)
    JOIN jugadors j ON j.id = d.jugador_id
    LEFT JOIN clubs jc ON jc.id = j.club_id
    JOIN jugadors r ON r.id = d.rival_id
    LEFT JOIN clubs rc ON rc.id = r.club_id
    WHERE p.jugador_2_id IS NOT NULL;

/** Els fets amb els filtres aplicats. */
CREATE OR REPLACE FUNCTION fets_filtrats(p_filtres JSONB)
RETURNS SETOF fets_partida
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM fets_partida f
    WHERE (p_filtres->>'des_de' IS NULL OR f.temporada >= p_filtres->>'des_de')
      AND (p_filtres->>'fins_a' IS NULL OR f.temporada <= p_filtres->>'fins_a')
      AND (p_filtres->>'club' IS NULL OR f.club = p_filtres->>'club')
      AND (p_filtres->>'campionat' IS NULL OR f.campionat_id = (p_filtres->>'campionat')::UUID)
      AND (p_filtres->>'jugador' IS NULL OR f.numero = (p_filtres->>'jugador')::INTEGER);
$$;

/**
 * Una consulta: `p_metrica` diu quina, i torna les files ja ordenades.
 * Cada fila porta `numero`, `nom` i `club` del jugador (si n'és una de
 * jugador), `valor` (el que s'ordena) i els detalls de cada consulta.
 */
CREATE OR REPLACE FUNCTION estadistica(p_metrica TEXT, p_filtres JSONB DEFAULT '{}', p_limit INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INTEGER := least(greatest(coalesce(p_limit, 50), 1), 500);
    v_minim INTEGER := coalesce((p_filtres->>'minim')::INTEGER, 0);
    v_resultat JSONB;
BEGIN
    IF p_metrica = 'barruf_maxim' THEN
        -- Primer es filtren les files d'estat, després s'agrupa per jugador.
        WITH v AS (
            SELECT j.id AS jugador_id, j.numero, j.nom_complet AS nom, cl.nom AS club,
                   round(v.barruf) AS barruf, v.posicio, v.partides_totals,
                   e.numero AS edicio, e.temporada_codi AS temporada
            FROM barruf_valors v
            JOIN barruf_edicions e ON e.id = v.edicio_id
            JOIN jugadors j ON j.id = v.jugador_id
            LEFT JOIN clubs cl ON cl.id = j.club_id
            WHERE j.fusionat_a IS NULL AND v.partides_totals > 10
              AND (p_filtres->>'des_de' IS NULL OR e.temporada_codi >= p_filtres->>'des_de')
              AND (p_filtres->>'fins_a' IS NULL OR e.temporada_codi <= p_filtres->>'fins_a')
              AND (p_filtres->>'club' IS NULL OR cl.nom = p_filtres->>'club')
              AND (p_filtres->>'jugador' IS NULL OR j.numero = (p_filtres->>'jugador')::INTEGER)
              AND (p_filtres->>'campionat' IS NULL OR EXISTS (
                    SELECT 1 FROM inscripcions i WHERE i.jugador_id = j.id AND i.campionat_id = (p_filtres->>'campionat')::UUID))
        ),
        maxims AS (
            SELECT DISTINCT ON (jugador_id) jugador_id, numero, nom, club, barruf AS valor, edicio, temporada
            FROM v ORDER BY jugador_id, barruf DESC, edicio
        ),
        resum AS (
            SELECT jugador_id, min(posicio) AS millor_posicio, max(partides_totals) AS partides
            FROM v GROUP BY jugador_id
        )
        SELECT COALESCE(jsonb_agg(y ORDER BY y.valor DESC, y.nom), '[]'::jsonb) INTO v_resultat FROM (
            SELECT m.numero, m.nom, m.club, m.valor, m.edicio, m.temporada, r.millor_posicio, r.partides
            FROM maxims m JOIN resum r USING (jugador_id)
            ORDER BY m.valor DESC, m.nom
            LIMIT v_limit
        ) y;

    ELSIF p_metrica IN ('partides', 'victories') THEN
        SELECT COALESCE(jsonb_agg(x ORDER BY x.valor DESC, x.nom), '[]'::jsonb) INTO v_resultat FROM (
            SELECT numero, nom, club,
                   CASE WHEN p_metrica = 'partides' THEN count(*)::NUMERIC
                        ELSE round(sum(resultat) / NULLIF(count(resultat), 0), 4) END AS valor,
                   count(*) AS partides,
                   count(resultat) AS amb_resultat,
                   sum(resultat) AS victories,
                   count(DISTINCT campionat_id) AS campionats,
                   count(DISTINCT temporada) AS temporades,
                   round(avg(punts)) AS punts_mitjans
            FROM fets_filtrats(p_filtres)
            GROUP BY numero, nom, club
            HAVING p_metrica = 'partides' OR count(resultat) >= greatest(v_minim, 1)
            ORDER BY 4 DESC, nom
            LIMIT v_limit
        ) x;

    ELSIF p_metrica = 'scrabbles' THEN
        SELECT COALESCE(jsonb_agg(x ORDER BY x.valor DESC, x.nom), '[]'::jsonb) INTO v_resultat FROM (
            SELECT numero, nom, club,
                   sum(scrabbles) AS valor,
                   count(*) AS partides,
                   round(avg(scrabbles), 2) AS mitjana,
                   max(scrabbles) AS record
            FROM fets_filtrats(p_filtres)
            WHERE scrabbles IS NOT NULL
            GROUP BY numero, nom, club
            HAVING count(*) >= greatest(v_minim, 1)
            ORDER BY sum(scrabbles) DESC, nom
            LIMIT v_limit
        ) x;

    ELSIF p_metrica IN ('millors_jugades', 'millors_lletra') THEN
        SELECT COALESCE(jsonb_agg(x ORDER BY x.valor DESC, x.data DESC), '[]'::jsonb) INTO v_resultat FROM (
            SELECT numero, nom, club,
                   CASE WHEN p_metrica = 'millors_jugades' THEN punts_mot ELSE punts_lletra END AS valor,
                   CASE WHEN p_metrica = 'millors_jugades' THEN mot ELSE mot_lletra END AS mot,
                   rival, rival_numero, campionat, campionat_id, temporada, ronda, data
            FROM fets_filtrats(p_filtres)
            WHERE (CASE WHEN p_metrica = 'millors_jugades' THEN punts_mot ELSE punts_lletra END) IS NOT NULL
            ORDER BY 4 DESC, data DESC
            LIMIT v_limit
        ) x;

    ELSIF p_metrica = 'enfrontaments' THEN
        SELECT COALESCE(jsonb_agg(x ORDER BY x.valor DESC, x.nom), '[]'::jsonb) INTO v_resultat FROM (
            SELECT numero, nom, club, rival_numero, rival, rival_club,
                   count(*) AS valor,
                   count(resultat) AS amb_resultat,
                   sum(resultat) AS victories,
                   count(DISTINCT campionat_id) AS campionats
            FROM fets_filtrats(p_filtres)
            -- Cada parella un cop, tret que es miri un jugador concret.
            WHERE p_filtres->>'jugador' IS NOT NULL OR numero < rival_numero
            GROUP BY numero, nom, club, rival_numero, rival, rival_club
            HAVING count(*) >= greatest(v_minim, 1)
            ORDER BY count(*) DESC, nom
            LIMIT v_limit
        ) x;

    ELSIF p_metrica = 'temporades' THEN
        -- Per temporada: jugadors, campionats, partides i debutants (primera
        -- temporada amb partides de cada jugador, sobre tot l'historial).
        SELECT COALESCE(jsonb_agg(x ORDER BY x.temporada), '[]'::jsonb) INTO v_resultat FROM (
            SELECT f.temporada,
                   count(DISTINCT f.numero) AS jugadors,
                   count(DISTINCT f.campionat_id) AS campionats,
                   count(DISTINCT f.partida_id) AS partides,
                   count(DISTINCT f.numero) FILTER (WHERE f.temporada = pt.primera) AS debutants
            FROM fets_filtrats(p_filtres) f
            JOIN (SELECT numero, min(temporada) AS primera FROM fets_partida GROUP BY numero) pt
              ON pt.numero = f.numero
            GROUP BY f.temporada
        ) x;

    ELSE
        RAISE EXCEPTION 'Consulta desconeguda: %', p_metrica;
    END IF;

    RETURN v_resultat;
END;
$$;

/** Els rècords vigents, sense filtres, per a la portada de les estadístiques. */
CREATE OR REPLACE FUNCTION estadistica_salo()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'barruf_maxim', estadistica('barruf_maxim', '{}', 1)->0,
        'partides', estadistica('partides', '{}', 1)->0,
        'victories', estadistica('victories', '{"minim": 200}', 1)->0,
        'millor_jugada', estadistica('millors_jugades', '{}', 1)->0,
        'millor_lletra', estadistica('millors_lletra', '{}', 1)->0,
        'scrabbles', estadistica('scrabbles', '{}', 1)->0,
        'scrabbles_partida', (
            SELECT jsonb_build_object('numero', numero, 'nom', nom, 'valor', scrabbles,
                                      'rival', rival, 'campionat', campionat, 'campionat_id', campionat_id)
            FROM fets_partida WHERE scrabbles IS NOT NULL ORDER BY scrabbles DESC, data DESC LIMIT 1
        ),
        'punts_partida', (
            SELECT jsonb_build_object('numero', numero, 'nom', nom, 'valor', punts,
                                      'rival', rival, 'campionat', campionat, 'campionat_id', campionat_id)
            FROM fets_partida WHERE punts IS NOT NULL ORDER BY punts DESC, data DESC LIMIT 1
        ),
        'enfrontament', estadistica('enfrontaments', '{}', 1)->0,
        'campionats', (
            SELECT jsonb_build_object('numero', numero, 'nom', nom, 'valor', count(DISTINCT campionat_id))
            FROM fets_partida GROUP BY numero, nom ORDER BY count(DISTINCT campionat_id) DESC LIMIT 1
        )
    );
$$;

GRANT EXECUTE ON FUNCTION fets_filtrats(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION estadistica(TEXT, JSONB, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION estadistica_salo() TO anon, authenticated;
