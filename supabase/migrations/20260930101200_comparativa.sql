-- =============================================================================
-- Comparativa entre dues edicions, i l'especial de final de temporada
-- =============================================================================
-- L'especial de final de temporada compara el darrer BARRUF de la temporada
-- anterior amb el darrer de l'actual. L'AJUSC el feia a mà, i el del 2025-26 va
-- comparar la 191 (el primer de la temporada) amb la 210: les progressions i
-- les variacions de posició no eren les de la temporada.
--
-- De passada: l'edició 190, la llavor, és de la temporada 2024-25 (ho diu el
-- seu PDF), no del 2025-26. La cadena no en fa servir la temporada; la
-- comparativa, sí.
-- =============================================================================

UPDATE barruf_edicions SET temporada_codi = '2024-25'
WHERE numero = 190 AND es_llavor AND temporada_codi = '2025-26';

/**
 * Com `informe_barruf`, però comparant amb l'edició que es diu, no amb la
 * immediatament anterior.
 */
CREATE OR REPLACE FUNCTION informe_comparatiu(p_numero INTEGER, p_anterior INTEGER)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH edicio AS (SELECT * FROM barruf_edicions WHERE numero = p_numero),
    anterior AS (SELECT * FROM barruf_edicions WHERE numero = p_anterior)
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM edicio) OR NOT EXISTS (SELECT 1 FROM anterior) THEN NULL
    ELSE jsonb_build_object(
        'edicio', (SELECT jsonb_build_object(
            'numero', e.numero,
            'data_publicacio', e.data_publicacio,
            'temporada', e.temporada_codi,
            'campionats_computats', e.campionats_computats,
            'resultats_acumulats', e.resultats_acumulats,
            'campionats_acumulats', e.campionats_acumulats
        ) FROM edicio e),
        'anterior', (SELECT numero FROM anterior),
        'files', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'numero', j.numero,
                'nom', j.nom_complet,
                'club', c.nom,
                'ordre', j.ordre_llista,
                'barruf', v.barruf,
                'estat', v.estat,
                'posicio', v.posicio,
                'debutant', v.debutant,
                'partides_totals', v.partides_totals,
                'victories_totals', v.victories_totals,
                'partides_temporada', v.partides_temporada,
                'victories_temporada', v.victories_temporada,
                'anterior', CASE WHEN a.jugador_id IS NULL THEN NULL ELSE jsonb_build_object(
                    'barruf', a.barruf,
                    'estat', a.estat,
                    'posicio', a.posicio,
                    'partides_totals', a.partides_totals,
                    'victories_totals', a.victories_totals
                ) END
            )), '[]'::jsonb)
            FROM barruf_valors v
            JOIN edicio e ON e.id = v.edicio_id
            JOIN jugadors j ON j.id = v.jugador_id
            LEFT JOIN clubs c ON c.id = j.club_id
            LEFT JOIN barruf_valors a
                ON a.jugador_id = v.jugador_id
               AND a.edicio_id = (SELECT id FROM anterior)
            WHERE j.fusionat_a IS NULL
        ),
        'clubs', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'nom', nom, 'nom_llegenda', nom_llegenda
            )), '[]'::jsonb)
            FROM clubs WHERE nom_llegenda IS NOT NULL
        )
    ) END;
$$;

/**
 * L'especial de final de temporada: el darrer BARRUF de la temporada (per
 * defecte, la de l'última edició) contra el darrer de la temporada anterior.
 * Afegeix quants campionats s'han barrufat a la temporada.
 */
CREATE OR REPLACE FUNCTION informe_temporada(p_temporada TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH temporada AS (
        SELECT COALESCE(p_temporada,
            (SELECT temporada_codi FROM barruf_edicions ORDER BY numero DESC LIMIT 1)) AS codi
    ),
    darrera AS (
        SELECT max(numero) AS numero FROM barruf_edicions
        WHERE temporada_codi = (SELECT codi FROM temporada)
    ),
    anterior AS (
        SELECT max(numero) AS numero FROM barruf_edicions
        WHERE temporada_codi < (SELECT codi FROM temporada)
    )
    SELECT informe_comparatiu((SELECT numero FROM darrera), (SELECT numero FROM anterior))
        || jsonb_build_object(
            'campionats_temporada', (
                SELECT count(*) FROM campionats
                WHERE temporada_codi = (SELECT codi FROM temporada)
                  AND primera_edicio IS NOT NULL
                  AND primera_edicio > (SELECT numero FROM anterior)
            ),
            'temporades', (
                SELECT jsonb_agg(DISTINCT temporada_codi ORDER BY temporada_codi DESC) FROM barruf_edicions
            )
        );
$$;

GRANT EXECUTE ON FUNCTION informe_comparatiu(INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION informe_temporada(TEXT) TO anon, authenticated;
