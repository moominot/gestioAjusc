-- =============================================================================
-- Estadístiques per estat: actius, inactius i en expectativa
-- =============================================================================
-- Un filtre més, `estat`, amb l'estat d'ara de cada jugador (el de l'última
-- edició), i tres consultes noves: el resum per estats, els inactius (quan i
-- com ho van deixar) i els que són en expectativa (quant els falta).

/** L'estat d'ara de cada jugador, pel número. */
CREATE OR REPLACE VIEW estat_actual
WITH (security_invoker = false) AS
    SELECT j.numero, v.estat::TEXT AS estat
    FROM barruf_valors v
    JOIN barruf_ultima_edicio e ON e.id = v.edicio_id
    JOIN jugadors j ON j.id = v.jugador_id;

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
      AND (p_filtres->>'jugador' IS NULL OR f.numero = (p_filtres->>'jugador')::INTEGER)
      AND (p_filtres->>'estat' IS NULL OR EXISTS (
            SELECT 1 FROM estat_actual ea WHERE ea.numero = f.numero AND ea.estat = p_filtres->>'estat'));
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
              AND (p_filtres->>'estat' IS NULL OR EXISTS (
                    SELECT 1 FROM estat_actual ea WHERE ea.numero = j.numero AND ea.estat = p_filtres->>'estat'))
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
        -- Per temporada: jugadors, campionats, partides, debutants (primera
        -- temporada amb partides de cada jugador, sobre tot l'historial) i
        -- comiats: els que ara són inactius i aquella va ser la darrera.
        SELECT COALESCE(jsonb_agg(x ORDER BY x.temporada), '[]'::jsonb) INTO v_resultat FROM (
            SELECT f.temporada,
                   count(DISTINCT f.numero) AS jugadors,
                   count(DISTINCT f.campionat_id) AS campionats,
                   count(DISTINCT f.partida_id) AS partides,
                   count(DISTINCT f.numero) FILTER (WHERE f.temporada = pt.primera) AS debutants,
                   count(DISTINCT f.numero) FILTER (WHERE f.temporada = pt.darrera AND ea.estat = 'inact') AS comiats
            FROM fets_filtrats(p_filtres) f
            JOIN (SELECT numero, min(temporada) AS primera, max(temporada) AS darrera FROM fets_partida GROUP BY numero) pt
              ON pt.numero = f.numero
            LEFT JOIN estat_actual ea ON ea.numero = f.numero
            GROUP BY f.temporada
        ) x;

    ELSIF p_metrica IN ('estats', 'inactius', 'expectativa') THEN
        -- Per jugador, l'estat d'ara i tot el que n'ha quedat a l'historial.
        -- Les temporades filtren per la darrera que va jugar.
        WITH j AS (
            SELECT b.jugador_numero AS numero, b.nom_complet AS nom, b.club, b.estat::TEXT AS estat,
                   round(b.barruf) AS barruf, b.categoria, b.partides_totals AS partides,
                   b.victories_totals AS victories, b.darrera_temporada, b.posicio
            FROM barruf_classificacio b
            WHERE (p_filtres->>'club' IS NULL OR b.club = p_filtres->>'club')
              AND (p_filtres->>'jugador' IS NULL OR b.jugador_numero = (p_filtres->>'jugador')::INTEGER)
              AND (p_filtres->>'estat' IS NULL OR b.estat::TEXT = p_filtres->>'estat')
              AND (p_filtres->>'des_de' IS NULL OR b.darrera_temporada >= p_filtres->>'des_de')
              AND (p_filtres->>'fins_a' IS NULL OR b.darrera_temporada <= p_filtres->>'fins_a')
              AND (p_filtres->>'campionat' IS NULL OR EXISTS (
                    SELECT 1 FROM fets_partida f WHERE f.numero = b.jugador_numero
                      AND f.campionat_id = (p_filtres->>'campionat')::UUID))
              AND b.partides_totals > 0
        ),
        h AS (
            SELECT jg.numero, max(round(v.barruf)) FILTER (WHERE v.partides_totals > 10) AS barruf_maxim,
                   min(v.posicio) AS millor_posicio
            FROM barruf_valors v JOIN jugadors jg ON jg.id = v.jugador_id
            WHERE jg.numero IN (SELECT numero FROM j)
            GROUP BY jg.numero
        ),
        f AS (
            SELECT numero, min(temporada) AS primera, count(DISTINCT temporada) AS temporades,
                   count(DISTINCT campionat_id) AS campionats, max(data) AS darrera_data
            FROM fets_partida WHERE numero IN (SELECT numero FROM j) GROUP BY numero
        ),
        t AS (
            SELECT j.*, h.barruf_maxim, h.millor_posicio, f.primera, f.temporades, f.campionats, f.darrera_data,
                   round(j.victories / NULLIF(j.partides, 0), 4) AS percentatge
            FROM j LEFT JOIN h USING (numero) LEFT JOIN f USING (numero)
        )
        SELECT CASE p_metrica
            WHEN 'estats' THEN (
                SELECT COALESCE(jsonb_agg(x ORDER BY array_position(ARRAY['act','exp','inact'], x.estat)), '[]'::jsonb) FROM (
                    SELECT estat, count(*) AS valor, sum(partides) AS partides,
                           round(avg(partides), 1) AS partides_mitjanes,
                           round(avg(barruf)) AS barruf_mitja,
                           round(avg(temporades), 1) AS temporades_mitjanes,
                           max(darrera_temporada) AS darrera_temporada
                    FROM t GROUP BY estat
                ) x)
            WHEN 'inactius' THEN (
                SELECT COALESCE(jsonb_agg(x ORDER BY x.valor DESC, x.nom), '[]'::jsonb) FROM (
                    SELECT numero, nom, club, barruf AS valor, barruf_maxim, millor_posicio, partides,
                           percentatge, primera, darrera_temporada, temporades, campionats
                    FROM t WHERE estat = 'inact' AND partides >= v_minim
                    ORDER BY barruf DESC, nom LIMIT v_limit
                ) x)
            ELSE (
                SELECT COALESCE(jsonb_agg(x ORDER BY x.valor DESC, x.darrera_temporada DESC NULLS LAST, x.nom), '[]'::jsonb) FROM (
                    SELECT numero, nom, club, partides AS valor, 11 - partides AS falten, barruf, percentatge,
                           primera, darrera_temporada, campionats, darrera_data
                    FROM t WHERE estat = 'exp'
                    ORDER BY partides DESC, darrera_temporada DESC NULLS LAST, nom LIMIT v_limit
                ) x)
        END INTO v_resultat FROM (SELECT 1) u;

    ELSE
        RAISE EXCEPTION 'Consulta desconeguda: %', p_metrica;
    END IF;

    RETURN v_resultat;
END;
$$;

GRANT SELECT ON estat_actual TO anon, authenticated;
