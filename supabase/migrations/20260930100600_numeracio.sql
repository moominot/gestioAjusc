-- =============================================================================
-- Números de jugador per ordre d'entrada al BARRUF
-- =============================================================================
-- Fins ara el número era l'ordre alfabètic de la llavor original, que no vol
-- dir res. Ara diu qui va entrar abans:
--
--  · Primer, els que ja eren a la primera edició que es conserva (la 70, de la
--    temporada 2014-15). De quan van entrar no se'n sap res, i s'ordenen per
--    les partides que duien jugades aleshores: qui més n'havia jugat, més
--    veterà.
--  · Després, la resta, per l'edició en què van aparèixer per primer cop i,
--    dins la mateixa edició, també per partides.
--  · A igualtat de tot, per nom.
--
-- Es fa un sol cop, abans que els números es publiquin enlloc: un cop publicat,
-- el número d'un jugador no ha de canviar mai.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE nou_numero ON COMMIT DROP AS
WITH primera AS (
    SELECT DISTINCT ON (v.jugador_id)
        v.jugador_id, e.numero AS edicio, v.partides_totals AS partides
    FROM barruf_valors v
    JOIN barruf_edicions e ON e.id = v.edicio_id
    ORDER BY v.jugador_id, e.numero
)
SELECT
    j.id,
    row_number() OVER (
        ORDER BY p.edicio NULLS LAST, p.partides DESC NULLS LAST, j.nom_complet, j.numero
    ) AS numero
FROM jugadors j
LEFT JOIN primera p ON p.jugador_id = j.id;

-- En dos passos perquè el número és únic: primer fora del camí, després al lloc.
UPDATE jugadors SET numero = numero + 1000000;
UPDATE jugadors j SET numero = n.numero FROM nou_numero n WHERE n.id = j.id;

SELECT setval('numero_jugador_seq', (SELECT max(numero) FROM jugadors));

COMMIT;
