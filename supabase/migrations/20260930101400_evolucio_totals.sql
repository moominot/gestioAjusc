-- =============================================================================
-- L'evolució d'un jugador, amb les partides totals de cada edició
-- =============================================================================
-- Perquè a la fitxa del jugador es pugui seguir la cadena fila a fila: el
-- BARRUF de després d'un campionat és el d'abans del següent, i les partides
-- totals creixen amb les del campionat. Les totals són les de l'estat publicat
-- a l'edició on es va computar el campionat.
-- =============================================================================

CREATE OR REPLACE VIEW jugador_evolucio
WITH (security_invoker = false) AS
    SELECT
        j.numero                AS jugador_numero,
        camp.id                 AS campionat_id,
        camp.nom                AS campionat,
        camp.data,
        camp.temporada_codi,
        var.barruf_abans,
        var.partides,
        var.victories,
        var.esperanca,
        var.factor_k,
        var.variacio,
        var.barruf_despres,
        camp.primera_edicio     AS edicio,
        val.partides_totals,
        val.victories_totals
    FROM barruf_variacions var
    JOIN jugadors j ON j.id = var.jugador_id
    JOIN campionats camp ON camp.id = var.campionat_id
    LEFT JOIN barruf_edicions e ON e.numero = camp.primera_edicio
    LEFT JOIN barruf_valors val ON val.edicio_id = e.id AND val.jugador_id = var.jugador_id
    ORDER BY camp.primera_edicio NULLS LAST, camp.data, camp.ordre;
