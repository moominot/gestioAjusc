-- =============================================================================
-- El BARRUF d'un jugador que encara no ha jugat és el de sortida, 950
-- =============================================================================
-- A l'edició 70, la primera de l'arxiu, el full de l'AJUSC tenia vuit
-- novells amb el BARRUF a 0. En comparar-hi, la progressió de la 71 sortia
-- de +1002 (Josep Coll) en comptes de +52: van començar amb 950, com tothom.
-- Les variacions d'aquells campionats també portaven 0 com a «BARRUF abans».
-- =============================================================================

UPDATE barruf_valors SET barruf = 950
WHERE barruf = 0 AND partides_totals = 0;

UPDATE barruf_variacions
SET barruf_abans = 950, variacio = barruf_despres - 950
WHERE barruf_abans = 0;
