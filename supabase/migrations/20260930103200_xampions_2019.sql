-- =============================================================================
-- Xàmpions d'estiu 2019: els punts del quadre
-- =============================================================================
-- Cada eliminatòria eren dues partides (rondes 2k-1 i 2k), però a la segona
-- s'hi havien copiat els punts i els scrabbles de la primera (o, en dos
-- casos, al revés). Aquí es posen els punts del quadre de classificació que
-- va publicar l'organització (2026-10-02), i en surt el resultat de cada
-- partida. Els aparellaments ja eren bons.
--
-- Una excepció: Bernat Amer – Miquela Grimalt, primera partida de la 3a
-- ronda (9è a 16è). El quadre diu 503–403, però es manté el 378–445 que hi
-- havia: és el que quadra amb les victòries oficials del BARRUF de tots dos.
--
-- Els scrabbles copiats es queden només a la partida d'on venien. El BARRUF
-- no canvia: és una edició d'arxiu.

CREATE TEMP TABLE quadre (ronda int, a text, a1 int, a2 int, b text, b1 int, b2 int);
INSERT INTO quadre VALUES
(1,'Francesc Vernet',326,401,'Joana M. Pasqual',286,311),
(1,'Antoni Riera',502,566,'Jaume Vives',403,339),
(1,'Seb. Mascaró',310,341,'Roger Cosso',386,398),
(1,'Maribel Servera',516,475,'Joan Gelabert',353,478),
(1,'Bernat Amer',400,380,'Carles Díez',322,361),
(1,'Esperança Martí',370,420,'Aina Garcia',484,403),
(1,'Margalida Bonnín',395,306,'Pere Grimalt V.',462,404),
(1,'Jaume Rigo',332,457,'Tomeu Riera',445,410),
(1,'Bel Llull',419,347,'Lina Riera',434,494),
(1,'Marg. Rosselló',387,323,'Miquela Grimalt',491,403),
(1,'Mateu Xurí',636,560,'Mar Bel',276,339),
(1,'Llorenç Carreres',388,289,'Joan Llodrà',361,477),
(1,'Pere Grimalt R.',370,569,'Xisco Truyols',527,489),
(1,'Marta Servera',382,366,'M. M. Matamalas',476,442),
(1,'Joan Pascual',513,488,'Juanjo Corzo',278,278),
(1,'Cati Sureda',287,336,'Andreu Fuster',522,447),
(2,'Francesc Vernet',372,291,'Lina Riera',481,478),
(2,'Antoni Riera',468,453,'Mateu Xurí',450,542),
(2,'Roger Cosso',607,334,'Aina Garcia',373,436),
(2,'Maribel Servera',410,442,'Joan Llodrà',459,424),
(2,'Bernat Amer',328,299,'Joan Pascual',522,593),
(2,'Pere Grimalt V.',466,490,'M. M. Matamalas',362,440),
(2,'Tomeu Riera',376,583,'Xisco Truyols',452,339),
(2,'Miquela Grimalt',403,392,'Andreu Fuster',503,616),
(2,'Marta Servera',339,179,'Margalida Bonnín',521,583),
(2,'Cati Sureda',423,313,'Juanjo Corzo',396,279),
(2,'Joana M. Pasqual',300,366,'Llorenç Carreres',322,471),
(2,'Joan Gelabert',474,526,'Pere Grimalt R.',314,459),
(2,'Bel Llull',377,382,'Jaume Rigo',378,314),
(2,'Jaume Vives',390,364,'Seb. Mascaró',287,257),
(2,'Esperança Martí',306,664,'Carles Díez',413,247),
(2,'Marg. Rosselló',317,387,'Mar Bel',623,247),
(3,'Lina Riera',485,349,'Pere Grimalt V.',399,390),
(3,'Mateu Xurí',626,307,'Joan Pascual',408,467),
(3,'Joan Llodrà',361,372,'Andreu Fuster',417,420),
(3,'Tomeu Riera',413,374,'Roger Cosso',483,344),
(3,'Francesc Vernet',310,320,'Antoni Riera',651,546),
(3,'Aina Garcia',370,386,'Xisco Truyols',429,517),
(3,'Bernat Amer',503,616,'Miquela Grimalt',403,292),
(3,'Maribel Servera',521,391,'M. M. Matamalas',438,471),
(3,'Margalida Bonnín',404,477,'Jaume Vives',406,309),
(3,'Cati Sureda',432,319,'Joan Gelabert',440,507),
(3,'Llorenç Carreres',398,242,'Bel Llull',364,569),
(3,'Esperança Martí',574,560,'Mar Bel',300,341),
(3,'Pere Grimalt R.',416,498,'Marta Servera',264,330),
(3,'Jaume Rigo',277,323,'Joana M. Pasqual',357,413),
(3,'Marg. Rosselló',304,293,'Seb. Mascaró',330,262),
(3,'Xavi Castelló',334,274,'Carles Díez',436,449),
(4,'Lina Riera',555,377,'Mateu Xurí',491,466),
(4,'Andreu Fuster',485,469,'Roger Cosso',402,341),
(4,'Joan Llodrà',459,501,'Pere Grimalt V.',454,362),
(4,'Joan Pascual',485,495,'Tomeu Riera',484,451),
(4,'Antoni Riera',555,420,'Xisco Truyols',427,373),
(4,'Maribel Servera',540,463,'Bernat Amer',256,391),
(4,'Francesc Vernet',307,389,'Miquela Grimalt',380,396),
(4,'Aina Garcia',459,437,'M. M. Matamalas',415,395),
(4,'Margalida Bonnín',318,469,'Esperança Martí',496,392),
(4,'Bel Llull',330,404,'Joan Gelabert',444,498),
(4,'Jaume Vives',434,447,'Llorenç Carreres',352,325),
(4,'Mar Bel',326,315,'Cati Sureda',483,398),
(4,'Joana M. Pasqual',330,363,'Carles Díez',442,428),
(4,'Marg. Rosselló',261,266,'Pere Grimalt R.',481,527),
(4,'Seb. Mascaró',305,373,'Jaume Rigo',402,404),
(4,'Marta Servera',376,522,'Xavi Castelló',263,211),
(5,'Mateu Xurí',425,428,'Andreu Fuster',406,460),
(5,'Lina Riera',436,519,'Roger Cosso',340,422),
(5,'Joan Llodrà',357,466,'Joan Pascual',588,395),
(5,'Pere Grimalt V.',423,355,'Tomeu Riera',475,465),
(5,'Antoni Riera',312,423,'Maribel Servera',561,501),
(5,'Xisco Truyols',615,421,'Bernat Amer',347,371),
(5,'Miquela Grimalt',380,371,'Aina Garcia',568,592),
(5,'Francesc Vernet',294,270,'M. M. Matamalas',548,531),
(5,'Esperança Martí',381,515,'Joan Gelabert',473,401),
(5,'Margalida Bonnín',432,380,'Bel Llull',382,450),
(5,'Jaume Vives',467,477,'Cati Sureda',393,284),
(5,'Llorenç Carreres',338,457,'Mar Bel',374,313),
(5,'Carles Díez',338,389,'Pere Grimalt R.',417,401),
(5,'Joana M. Pasqual',365,342,'Marg. Rosselló',314,377),
(5,'Jaume Rigo',420,476,'Marta Servera',407,396),
(5,'Seb. Mascaró',258,262,'Xavi Castelló',339,325);

CREATE TEMP TABLE noms_quadre (nom TEXT, nom_complet TEXT);
INSERT INTO noms_quadre VALUES
    ('Joana M. Pasqual', 'Joana Maria Pasqual'), ('Seb. Mascaró', 'Sebastiana Mascaró'),
    ('Marg. Rosselló', 'Margalida Rosselló'), ('Lina Riera', 'Lina Maria Riera'),
    ('Pere Grimalt V.', 'Pere Grimalt Vert'), ('Pere Grimalt R.', 'Pere Grimalt Riera');

CREATE TEMP TABLE partides_quadre AS
WITH camp AS (SELECT id FROM campionats WHERE nom = 'Xàmpions d''estiu 2019'),
jug AS (
    SELECT x.nom, j.id
    FROM (SELECT a AS nom FROM quadre UNION SELECT b FROM quadre) x
    LEFT JOIN noms_quadre n ON n.nom = x.nom
    JOIN inscripcions i ON i.campionat_id = (SELECT id FROM camp)
    JOIN jugadors j ON j.id = i.jugador_id AND j.nom_complet = coalesce(n.nom_complet, x.nom)
)
SELECT q.ronda * 2 - 1 AS ronda, ja.id AS ja, jb.id AS jb, q.a1 AS pa, q.b1 AS pb, true AS primera
FROM quadre q JOIN jug ja ON ja.nom = q.a JOIN jug jb ON jb.nom = q.b
UNION ALL
SELECT q.ronda * 2, ja.id, jb.id, q.a2, q.b2, false
FROM quadre q JOIN jug ja ON ja.nom = q.a JOIN jug jb ON jb.nom = q.b;

DO $$
BEGIN
    IF (SELECT count(*) FROM partides_quadre) <> 160 THEN
        RAISE EXCEPTION 'Xàmpions 2019: s''esperaven 160 partides del quadre i n''hi ha %', (SELECT count(*) FROM partides_quadre);
    END IF;
END $$;

-- Els dos parells on la còpia havia anat de la segona partida a la primera.
CREATE TEMP TABLE copia_inversa AS
SELECT p.campionat_id, p.ronda, least(p.jugador_1_id, p.jugador_2_id) x, greatest(p.jugador_1_id, p.jugador_2_id) y
FROM partides p
JOIN partides_quadre q ON q.ronda = p.ronda AND q.primera
 AND least(q.ja, q.jb) = least(p.jugador_1_id, p.jugador_2_id) AND greatest(q.ja, q.jb) = greatest(p.jugador_1_id, p.jugador_2_id)
JOIN partides_quadre q2 ON q2.ronda = p.ronda + 1 AND q2.ja = q.ja AND q2.jb = q.jb
WHERE p.campionat_id = (SELECT id FROM campionats WHERE nom = 'Xàmpions d''estiu 2019')
  AND (CASE WHEN p.jugador_1_id = q.ja THEN p.punts_1 = q2.pa AND p.punts_2 = q2.pb ELSE p.punts_1 = q2.pb AND p.punts_2 = q2.pa END)
  AND NOT (CASE WHEN p.jugador_1_id = q.ja THEN p.punts_1 = q.pa AND p.punts_2 = q.pb ELSE p.punts_1 = q.pb AND p.punts_2 = q.pa END);

UPDATE partides p
SET punts_1 = CASE WHEN p.jugador_1_id = q.ja THEN q.pa ELSE q.pb END,
    punts_2 = CASE WHEN p.jugador_1_id = q.ja THEN q.pb ELSE q.pa END,
    resultat_1 = CASE
        WHEN (CASE WHEN p.jugador_1_id = q.ja THEN q.pa ELSE q.pb END) > (CASE WHEN p.jugador_1_id = q.ja THEN q.pb ELSE q.pa END) THEN 1
        WHEN (CASE WHEN p.jugador_1_id = q.ja THEN q.pa ELSE q.pb END) < (CASE WHEN p.jugador_1_id = q.ja THEN q.pb ELSE q.pa END) THEN 0
        ELSE 0.5 END,
    -- Els scrabbles, només a la partida d'on venien.
    scrabbles_1 = CASE WHEN q.primera = (c.ronda IS NULL) THEN p.scrabbles_1 END,
    scrabbles_2 = CASE WHEN q.primera = (c.ronda IS NULL) THEN p.scrabbles_2 END
FROM partides_quadre q
LEFT JOIN copia_inversa c ON c.ronda = q.ronda - CASE WHEN q.primera THEN 0 ELSE 1 END
     AND c.x = least(q.ja, q.jb) AND c.y = greatest(q.ja, q.jb)
WHERE p.campionat_id = (SELECT id FROM campionats WHERE nom = 'Xàmpions d''estiu 2019')
  AND p.ronda = q.ronda
  AND least(p.jugador_1_id, p.jugador_2_id) = least(q.ja, q.jb)
  AND greatest(p.jugador_1_id, p.jugador_2_id) = greatest(q.ja, q.jb)
  -- L'excepció: Bernat Amer – Miquela Grimalt, ronda 5, es queda com era.
  AND NOT (p.ronda = 5 AND p.jugador_1_id IN (SELECT id FROM jugadors WHERE nom_complet IN ('Bernat Amer', 'Miquela Grimalt'))
                       AND p.jugador_2_id IN (SELECT id FROM jugadors WHERE nom_complet IN ('Bernat Amer', 'Miquela Grimalt')));

-- La partida de l'excepció: el resultat dels seus punts, i els scrabbles hi són.
UPDATE partides p
SET resultat_1 = CASE WHEN p.punts_1 > p.punts_2 THEN 1 WHEN p.punts_1 < p.punts_2 THEN 0 ELSE 0.5 END
WHERE p.campionat_id = (SELECT id FROM campionats WHERE nom = 'Xàmpions d''estiu 2019')
  AND p.resultat_1 IS NULL AND p.punts_1 IS NOT NULL;

DROP TABLE quadre, noms_quadre, partides_quadre, copia_inversa;
