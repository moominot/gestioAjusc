-- =============================================================================
-- Organitzadors que la deducció pel nom no podia saber
-- =============================================================================
-- Segons l'AJUSC:
--  · La LLISCA i el I Campionat de la Fitxa Confinada els organitzava l'AJUSC.
--  · Els campionats Vila de Petra i el Torneig Vila d'Artà, el CS Manacor.
-- Els dos combinats de l'arxiu (edicions 71 i 72) barregen campionats de
-- diversos organitzadors i es queden sense.
-- =============================================================================

-- L'AJUSC com a organitzadora. No té jugadors, i per això no porta nom de
-- llegenda: la llegenda de clubs del PDF és la dels clubs dels jugadors.
INSERT INTO clubs (nom) VALUES ('AJUSC') ON CONFLICT (nom) DO NOTHING;

UPDATE campionats c SET club_organitzador_id = (SELECT id FROM clubs WHERE nom = 'AJUSC')
WHERE c.club_organitzador_id IS NULL
  AND (normalitza_nom(c.nom) ~ 'llisca|fitxa confinada')
  AND c.nom NOT LIKE 'Petra, %' AND c.nom NOT LIKE 'LLISCA + %';

UPDATE campionats c SET club_organitzador_id = (SELECT id FROM clubs WHERE nom = 'Manacor')
WHERE c.club_organitzador_id IS NULL
  AND normalitza_nom(c.nom) ~ 'vila de petra|vila d''arta';
