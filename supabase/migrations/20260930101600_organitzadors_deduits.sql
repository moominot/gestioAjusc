-- =============================================================================
-- Club organitzador dels campionats, deduït del nom
-- =============================================================================
-- Els campionats de l'arxiu no porten el club organitzador. Quan el nom el diu
-- clarament («ManaCup», «Copa de Molins», «Campionat de Badalona»…) s'hi posa.
-- Només es toquen els que no en tenen cap. Els dubtosos (combinats, LLISCA,
-- Petra, Artà, Obert dels PPCC, emParaular, Fitxa Confinada) es deixen buits
-- perquè algú els ompli a mà des de l'edició del campionat.
--
-- L'ordre de les regles compta: la sèrie «Gran Campionat» és de la FISC encara
-- que porti el nom d'una ciutat amb club («Gran Campionat de Manacor»).
-- =============================================================================

WITH regles (ordre, patro, club) AS (VALUES
    (1,  'gran campionat',                 'FISC'),
    (2,  'mundial',                        'FISC'),
    (3,  'manacup|xampions|ciutat de manacor|campionat de manacor', 'Manacor'),
    (4,  'molins|mimam',                   'MiMaM'),
    (5,  'delta prat',                     'Delta Prat'),
    (6,  'escarxofa|obert de scrabble el prat', 'el Prat'),
    (7,  'xitxarello|vendrell',            'el Vendrell'),
    (8,  'sabadell',                       'Sabadell'),
    (9,  'badalona',                       'Badalona'),
    (10, 'eivissa',                        'Eivissa'),
    (11, 'manresa',                        'Manresa'),
    (12, 'canet',                          'Canet'),
    (13, 'porreres',                       'Porreres'),
    (14, 'portol',                         'Pòrtol'),
    (15, 'lligueta llongueta|ciutat de mallorca', 'Palma'),
    (16, 'sant andreu de palomar',         'SACS')
),
candidats AS (
    SELECT DISTINCT ON (c.id) c.id, cl.id AS club_id
    FROM campionats c
    JOIN regles r ON normalitza_nom(c.nom) ~ r.patro
    JOIN clubs cl ON cl.nom = r.club
    WHERE c.club_organitzador_id IS NULL
      -- La LLISCA i els combinats de l'arxiu (que la inclouen), Petra i l'Obert
      -- dels PPCC no tenen un club clar.
      AND normalitza_nom(c.nom) !~ 'llisca|petra|ppcc'
    ORDER BY c.id, r.ordre
)
UPDATE campionats c SET club_organitzador_id = k.club_id
FROM candidats k
WHERE c.id = k.id;
