-- =============================================================================
-- Resultats deduïts dels punts, on quadren amb les victòries oficials
-- =============================================================================
-- Cinc campionats d'arxiu (2018-19 i 2019-20) tenien la puntuació de cada
-- partida però no el resultat: dels fulls només se'n van conservar els
-- aparellaments i les victòries totals, i els punts van venir després del
-- full de l'usuari. La fitxa del campionat no podia marcar qui guanyava.
--
-- Els punts no sempre quadren amb les victòries oficials (n'hi ha
-- d'intercanviats o d'una altra partida), així que només s'omple el
-- resultat d'una partida si els dos jugadors, comptant per punts, sumen
-- exactament les victòries que el BARRUF els dona en aquell campionat. La
-- resta queda sense resultat per revisar-la a mà (2026-10-02).
--
-- El BARRUF no en canvia: són edicions d'arxiu, que no es rejuguen.

WITH camps AS (
    SELECT DISTINCT campionat_id FROM partides
    WHERE resultat_1 IS NULL AND punts_1 IS NOT NULL AND punts_2 IS NOT NULL
),
costat AS (
    SELECT p.campionat_id, p.jugador_1_id AS jid, p.punts_1 AS pf, p.punts_2 AS pc, p.resultat_1 AS r
    FROM partides p JOIN camps USING (campionat_id) WHERE p.jugador_2_id IS NOT NULL
    UNION ALL
    SELECT p.campionat_id, p.jugador_2_id, p.punts_2, p.punts_1, 1 - p.resultat_1
    FROM partides p JOIN camps USING (campionat_id) WHERE p.jugador_2_id IS NOT NULL
    UNION ALL
    SELECT p.campionat_id, p.jugador_1_id, NULL, NULL, 1
    FROM partides p JOIN camps USING (campionat_id) WHERE p.jugador_2_id IS NULL
),
deduides AS (
    SELECT campionat_id, jid,
           sum(coalesce(r, CASE WHEN pf > pc THEN 1 WHEN pf < pc THEN 0 WHEN pf = pc THEN 0.5 END)) AS v
    FROM costat GROUP BY campionat_id, jid
),
quadren AS (
    SELECT d.campionat_id, d.jid
    FROM deduides d
    JOIN barruf_variacions var ON var.campionat_id = d.campionat_id AND var.jugador_id = d.jid
    WHERE d.v = var.victories
)
UPDATE partides p
SET resultat_1 = CASE WHEN p.punts_1 > p.punts_2 THEN 1 WHEN p.punts_1 < p.punts_2 THEN 0 ELSE 0.5 END
WHERE p.resultat_1 IS NULL
  AND p.punts_1 IS NOT NULL AND p.punts_2 IS NOT NULL
  AND EXISTS (SELECT 1 FROM quadren q WHERE q.campionat_id = p.campionat_id AND q.jid = p.jugador_1_id)
  AND EXISTS (SELECT 1 FROM quadren q WHERE q.campionat_id = p.campionat_id AND q.jid = p.jugador_2_id);
