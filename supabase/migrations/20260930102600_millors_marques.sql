-- =============================================================================
-- Millors marques d'un jugador al BARRUF
-- =============================================================================
-- La millor posició que ha tingut mai i el BARRUF més alt (d'on surt la millor
-- categoria), amb l'edició on els va assolir per primer cop.
-- =============================================================================

CREATE OR REPLACE FUNCTION millors_marques(p_numero INTEGER)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH valors AS (
        SELECT e.numero AS edicio, e.temporada_codi AS temporada, v.posicio, v.barruf
        FROM barruf_valors v
        JOIN barruf_edicions e ON e.id = v.edicio_id
        JOIN jugadors j ON j.id = v.jugador_id
        WHERE j.numero = p_numero AND j.fusionat_a IS NULL AND v.partides_totals > 0
    )
    SELECT jsonb_build_object(
        'millor_posicio', (
            SELECT jsonb_build_object('posicio', posicio, 'edicio', edicio, 'temporada', temporada,
                                      'vegades', (SELECT count(*) FROM valors v2 WHERE v2.posicio = v.posicio))
            FROM valors v WHERE posicio IS NOT NULL ORDER BY posicio, edicio LIMIT 1
        ),
        'maxim', (
            SELECT jsonb_build_object('barruf', round(barruf), 'edicio', edicio, 'temporada', temporada)
            FROM valors ORDER BY round(barruf) DESC, edicio LIMIT 1
        )
    );
$$;

GRANT EXECUTE ON FUNCTION millors_marques(INTEGER) TO anon, authenticated;
