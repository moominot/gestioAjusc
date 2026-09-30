-- =============================================================================
-- Ordre correlatiu dels campionats d'un jugador
-- =============================================================================
-- Molts campionats antics no tenien data i en porten una de genèrica (la de
-- final de temporada o la del BARRUF on es van computar), de manera que n'hi
-- ha uns quants amb la mateixa. Ordenats per data, l'evolució d'un jugador
-- sortia desendreçada: el BARRUF d'abans d'un campionat no era el de després
-- de l'anterior, ni les partides totals anaven lligades.
--
-- L'ordre bo és el de la cadena: l'edició on es va computar cada campionat.
-- Les vistes l'exposen (`edicio`) perquè l'aplicació hi pugui ordenar.
-- Els campionats encara no barrufats no en tenen: van al final de la cadena.
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
        camp.primera_edicio     AS edicio
    FROM barruf_variacions var
    JOIN jugadors j ON j.id = var.jugador_id
    JOIN campionats camp ON camp.id = var.campionat_id
    ORDER BY camp.primera_edicio NULLS LAST, camp.data, camp.ordre;

CREATE OR REPLACE VIEW enfrontaments
WITH (security_invoker = false) AS
    SELECT
        jo.numero               AS jugador_numero,
        rival.numero            AS rival_numero,
        rival.nom_complet       AS rival,
        p.campionat_id,
        camp.nom                AS campionat,
        camp.data,
        p.ronda,
        d.resultat,
        d.punts,
        d.punts_rival,
        camp.temporada_codi,
        camp.primera_edicio     AS edicio
    FROM partides p
    JOIN campionats camp ON camp.id = p.campionat_id
    CROSS JOIN LATERAL (
        VALUES
            (p.jugador_1_id, p.jugador_2_id, p.resultat_1, p.punts_1, p.punts_2),
            (p.jugador_2_id, p.jugador_1_id, 1 - p.resultat_1, p.punts_2, p.punts_1)
    ) AS d(jugador_id, rival_id, resultat, punts, punts_rival)
    JOIN jugadors jo ON jo.id = d.jugador_id
    JOIN jugadors rival ON rival.id = d.rival_id
    WHERE p.jugador_2_id IS NOT NULL;
