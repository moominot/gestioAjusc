-- =============================================================================
-- Els mundials els organitza l'AJUSC
-- =============================================================================
-- Els quatre mundials de l'historial (2016-17, 2018-19, 2022-23 i 2024-25)
-- tenien la FISC com a organitzadora. Ja aplicat a mà a la rèplica el
-- 2026-10-02; aquí perquè una base de dades nova en surti igual.

UPDATE campionats
SET club_organitzador_id = (SELECT id FROM clubs WHERE nom = 'AJUSC')
WHERE nom ILIKE '%mundial%'
  AND club_organitzador_id IS DISTINCT FROM (SELECT id FROM clubs WHERE nom = 'AJUSC');
