-- =============================================================================
-- Pàgines de clubs
-- =============================================================================
-- `resum_clubs()` per a la llista i `fitxa_club(nom)` per a la fitxa de cada
-- club: membres amb el seu BARRUF, xifres, campionats que organitza, en quins
-- han jugat els membres i com els va contra els altres clubs.
--
-- El club d'un jugador és l'actual: no es guarda de quin club era quan va
-- jugar cada partida. Les xifres històriques són «dels membres d'ara».
-- Públic, com la classificació: només hi surt el que ja es publica.
-- =============================================================================

CREATE OR REPLACE FUNCTION resum_clubs()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH ultima AS (SELECT id FROM barruf_edicions ORDER BY numero DESC LIMIT 1),
    membres AS (
        SELECT j.club_id, j.numero, j.nom_complet, v.barruf, v.estat, v.posicio, v.partides_totals
        FROM jugadors j
        LEFT JOIN barruf_valors v ON v.jugador_id = j.id AND v.edicio_id = (SELECT id FROM ultima)
        WHERE j.fusionat_a IS NULL AND j.club_id IS NOT NULL
    )
    SELECT COALESCE(jsonb_agg(x ORDER BY x.actius DESC, x.membres DESC, x.nom), '[]'::jsonb)
    FROM (
        SELECT
            c.nom,
            c.nom_llegenda,
            (SELECT count(*) FROM membres m WHERE m.club_id = c.id) AS membres,
            (SELECT count(*) FROM membres m WHERE m.club_id = c.id AND m.estat = 'act') AS actius,
            (SELECT round(avg(m.barruf)) FROM membres m WHERE m.club_id = c.id AND m.estat = 'act') AS mitjana_actius,
            (SELECT jsonb_build_object('numero', m.numero, 'nom', m.nom_complet, 'posicio', m.posicio)
             FROM membres m WHERE m.club_id = c.id AND m.posicio IS NOT NULL
             ORDER BY m.posicio LIMIT 1) AS millor,
            (SELECT count(*) FROM campionats k WHERE k.club_organitzador_id = c.id) AS organitzats
        FROM clubs c
    ) x
    WHERE x.membres > 0 OR x.organitzats > 0;
$$;

CREATE OR REPLACE FUNCTION fitxa_club(p_nom TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH club AS (SELECT * FROM clubs WHERE nom = p_nom),
    ultima AS (SELECT id, numero, temporada_codi FROM barruf_edicions ORDER BY numero DESC LIMIT 1),
    membres AS (
        SELECT j.id, j.numero, j.nom_complet, v.barruf, v.estat, v.posicio,
               v.partides_totals, v.victories_totals, v.partides_temporada, v.victories_temporada,
               v.darrera_temporada
        FROM jugadors j
        LEFT JOIN barruf_valors v ON v.jugador_id = j.id AND v.edicio_id = (SELECT id FROM ultima)
        WHERE j.fusionat_a IS NULL AND j.club_id = (SELECT id FROM club)
    ),
    -- Cada partida des del costat del membre.
    costats AS (
        SELECT p.campionat_id, p.jugador_1_id AS jugador_id, p.jugador_2_id AS rival_id, p.resultat_1 AS resultat
        FROM partides p WHERE p.jugador_2_id IS NOT NULL AND p.jugador_1_id IN (SELECT id FROM membres)
        UNION ALL
        SELECT p.campionat_id, p.jugador_2_id, p.jugador_1_id, 1 - p.resultat_1
        FROM partides p WHERE p.jugador_2_id IS NOT NULL AND p.jugador_2_id IN (SELECT id FROM membres)
    )
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM club) THEN NULL ELSE jsonb_build_object(
        'club', (SELECT jsonb_build_object('nom', nom, 'nom_llegenda', nom_llegenda) FROM club),
        'edicio', (SELECT jsonb_build_object('numero', numero, 'temporada', temporada_codi) FROM ultima),
        'membres', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'numero', m.numero, 'nom', m.nom_complet, 'barruf', m.barruf, 'estat', m.estat,
                'posicio', m.posicio, 'partides_totals', m.partides_totals,
                'victories_totals', m.victories_totals, 'partides_temporada', m.partides_temporada,
                'victories_temporada', m.victories_temporada, 'darrera_temporada', m.darrera_temporada
            ) ORDER BY m.posicio NULLS LAST, m.barruf DESC NULLS LAST, m.nom_complet), '[]'::jsonb)
            FROM membres m
        ),
        'organitzats', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', k.id, 'nom', k.nom, 'data', k.data, 'temporada', k.temporada_codi,
                'primera_edicio', k.primera_edicio,
                'participants', (SELECT count(*) FROM inscripcions i WHERE i.campionat_id = k.id),
                'partides', (SELECT count(*) FROM partides p WHERE p.campionat_id = k.id)
            ) ORDER BY k.primera_edicio DESC NULLS FIRST, k.data DESC), '[]'::jsonb)
            FROM campionats k WHERE k.club_organitzador_id = (SELECT id FROM club)
        ),
        -- Els campionats on han jugat més membres.
        'campionats_membres', (
            SELECT COALESCE(jsonb_agg(x ORDER BY x.membres DESC, x.data DESC), '[]'::jsonb)
            FROM (
                SELECT k.id, k.nom, k.data, k.temporada_codi AS temporada, count(*) AS membres
                FROM inscripcions i JOIN campionats k ON k.id = i.campionat_id
                WHERE i.jugador_id IN (SELECT id FROM membres)
                GROUP BY k.id
                ORDER BY count(*) DESC, k.data DESC
                LIMIT 10
            ) x
        ),
        -- Per temporada: quants membres hi han jugat i quantes partides.
        'temporades', (
            SELECT COALESCE(jsonb_agg(x ORDER BY x.temporada DESC), '[]'::jsonb)
            FROM (
                SELECT k.temporada_codi AS temporada,
                       count(DISTINCT c.jugador_id) AS jugadors,
                       count(*) AS partides,
                       sum(c.resultat) AS victories,
                       count(*) FILTER (WHERE c.resultat IS NOT NULL) AS amb_resultat,
                       count(DISTINCT c.campionat_id) AS campionats
                FROM costats c JOIN campionats k ON k.id = c.campionat_id
                GROUP BY k.temporada_codi
            ) x
        ),
        -- Contra els membres dels altres clubs, en partides amb resultat conegut.
        'contra_clubs', (
            SELECT COALESCE(jsonb_agg(x ORDER BY x.partides DESC), '[]'::jsonb)
            FROM (
                SELECT rc.nom AS club, count(*) AS partides, sum(c.resultat) AS victories
                FROM costats c
                JOIN jugadors r ON r.id = c.rival_id
                JOIN clubs rc ON rc.id = r.club_id
                WHERE c.resultat IS NOT NULL AND r.club_id <> (SELECT id FROM club)
                GROUP BY rc.nom
            ) x
        )
    ) END;
$$;

GRANT EXECUTE ON FUNCTION resum_clubs() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fitxa_club(TEXT) TO anon, authenticated;
