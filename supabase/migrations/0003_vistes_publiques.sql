-- =============================================================================
-- Model de lectura públic
-- =============================================================================
-- Les consultes que fa l'aplicació viuen aquí i no escampades pel codi, de
-- manera que la forma de les dades i què és públic es decideixen un sol cop.
--
-- Totes les vistes són `security_invoker = false`: s'executen amb els permisos
-- del propietari i exposen exactament les columnes que hi ha escrites. Així es
-- pot publicar el nom i el club d'un jugador sense obrir la taula `jugadors`,
-- que conté el telèfon i el correu.
-- =============================================================================

/**
 * Categoria segons el BARRUF, tal com les publica l'AJUSC.
 * Per sota de 1000 no hi ha categoria definida.
 */
CREATE OR REPLACE FUNCTION categoria_barruf(barruf NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN barruf >= 1400 THEN 'Gran Gran Mestre'
        WHEN barruf >= 1300 THEN 'Gran Mestre'
        WHEN barruf >= 1200 THEN 'Mestre'
        WHEN barruf >= 1100 THEN 'Expert'
        WHEN barruf >= 1000 THEN 'Avançat'
        ELSE NULL
    END;
$$;

-- L'edició publicada més recent. Tot el que es mostra hi va referit.
CREATE OR REPLACE VIEW barruf_ultima_edicio
WITH (security_invoker = false) AS
    SELECT * FROM barruf_edicions ORDER BY numero DESC LIMIT 1;

/**
 * La classificació publicada: una fila per jugador de l'última edició.
 *
 * Hi surten tots els estats. Qui vulgui només la llista d'actius que filtri
 * per `estat = 'act'`, que és la que porta posició.
 */
CREATE OR REPLACE VIEW barruf_classificacio
WITH (security_invoker = false) AS
    SELECT
        e.numero                AS edicio,
        e.data_publicacio,
        v.posicio,
        j.numero                AS jugador_numero,
        j.nom_complet,
        c.nom                   AS club,
        v.barruf,
        categoria_barruf(v.barruf) AS categoria,
        v.estat,
        v.partides_totals,
        v.victories_totals,
        v.partides_temporada,
        v.victories_temporada,
        v.darrera_temporada,
        v.debutant
    FROM barruf_valors v
    JOIN barruf_ultima_edicio e ON e.id = v.edicio_id
    JOIN jugadors j ON j.id = v.jugador_id
    LEFT JOIN clubs c ON c.id = j.club_id
    WHERE j.fusionat_a IS NULL;

/**
 * Fitxa pública d'un jugador: el seu estat a l'última edició.
 */
CREATE OR REPLACE VIEW jugador_fitxa
WITH (security_invoker = false) AS
    SELECT
        j.id                    AS jugador_id,
        j.numero,
        j.nom_complet,
        c.nom                   AS club,
        v.barruf,
        categoria_barruf(v.barruf) AS categoria,
        v.estat,
        v.posicio,
        v.partides_totals,
        v.victories_totals,
        CASE WHEN v.partides_totals > 0
             THEN ROUND(100.0 * v.victories_totals / v.partides_totals, 1)
        END                     AS percentatge_victories,
        v.darrera_temporada
    FROM jugadors j
    LEFT JOIN clubs c ON c.id = j.club_id
    LEFT JOIN barruf_ultima_edicio e ON TRUE
    LEFT JOIN barruf_valors v ON v.jugador_id = j.id AND v.edicio_id = e.id
    WHERE j.fusionat_a IS NULL;

/**
 * Evolució del BARRUF d'un jugador, campionat a campionat.
 *
 * És la resposta a «per què tinc aquesta puntuació?»: cada fila diu contra
 * quina esperança va jugar, amb quin factor K i quant li va variar.
 */
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
        var.barruf_despres
    FROM barruf_variacions var
    JOIN jugadors j ON j.id = var.jugador_id
    JOIN campionats camp ON camp.id = var.campionat_id
    ORDER BY camp.data, camp.ordre;

/**
 * Històric d'enfrontaments: una fila per partida i per punt de vista.
 *
 * Es desdobla aquí, i no al codi, perquè així consultar «totes les partides de
 * tal jugador» és un `WHERE jugador_numero = ...` i prou.
 */
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
        d.punts_rival
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

/**
 * Campionats amb el seu estat de cara a la cadena.
 */
CREATE OR REPLACE VIEW campionats_publics
WITH (security_invoker = false) AS
    SELECT
        camp.id,
        camp.nom,
        camp.data,
        camp.temporada_codi,
        camp.organitzador,
        club.nom                AS club_organitzador,
        camp.computa_barruf,
        camp.finalitzat,
        (camp.computa_barruf AND camp.finalitzat) AS barrufat,
        camp.rondes_previstes,
        camp.rondes_jugades,
        (SELECT count(*) FROM inscripcions i WHERE i.campionat_id = camp.id) AS participants,
        (SELECT count(*) FROM partides p WHERE p.campionat_id = camp.id)     AS partides
    FROM campionats camp
    LEFT JOIN clubs club ON club.id = camp.club_organitzador_id
    ORDER BY camp.data DESC, camp.ordre DESC;

GRANT SELECT ON
    barruf_ultima_edicio, barruf_classificacio, jugador_fitxa,
    jugador_evolucio, enfrontaments, campionats_publics
TO anon, authenticated;
