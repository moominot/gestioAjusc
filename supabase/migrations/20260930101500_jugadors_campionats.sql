-- =============================================================================
-- Qui ha jugat cada campionat, per a les estadístiques de la llista
-- =============================================================================
-- La llista de campionats calcula les estadístiques del que hi ha filtrat, i per
-- comptar jugadors diferents li cal saber qui hi ha a cada campionat. Són
-- ~15.000 inscripcions: massa files per a una consulta normal (l'API en torna
-- 1.000), però un sol objecte compacte, número per número, sí que hi cap.
-- =============================================================================

CREATE OR REPLACE FUNCTION jugadors_per_campionat()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'campionats', (
            SELECT COALESCE(jsonb_object_agg(campionat_id, numeros), '{}'::jsonb)
            FROM (
                SELECT i.campionat_id, jsonb_agg(j.numero ORDER BY j.numero) AS numeros
                FROM inscripcions i
                JOIN jugadors j ON j.id = i.jugador_id
                WHERE j.fusionat_a IS NULL
                GROUP BY i.campionat_id
            ) x
        ),
        'noms', (
            SELECT COALESCE(jsonb_object_agg(numero, nom_complet), '{}'::jsonb)
            FROM jugadors WHERE fusionat_a IS NULL
        )
    );
$$;

GRANT EXECUTE ON FUNCTION jugadors_per_campionat() TO anon, authenticated;
