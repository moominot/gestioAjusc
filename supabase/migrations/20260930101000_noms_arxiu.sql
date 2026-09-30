-- =============================================================================
-- Noms dels campionats de l'arxiu
-- =============================================================================
-- El generador de l'arxiu va treure el nom de cada campionat de la cel·la del
-- full DadesTorneig, i en molts fulls era un residu de la plantilla de
-- l'edició anterior: la 121, per exemple, deia «1a fase de la Lligueta
-- Llongueta 2018/19» i és la 3a Jornada estiuenca de Badalona. Les dades
-- (partides i estat) sí que eren de l'edició bona; només en fallava el nom.
--
-- Fonts dels noms bons:
--  · Edicions 125-140: la línia «Campionat computat» del PDF publicat, tret de
--    la 139, on el PDF repeteix el de la 138 i la carpeta diu el que és.
--  · Edicions anteriors: els fitxers del campionat a la carpeta de l'edició.
-- De la 141 endavant els noms ja coincidien amb els PDF.
-- =============================================================================

BEGIN;

WITH noms (edicio, nom) AS (VALUES
    (73,  'ManaCup 2015-16'),
    (74,  'Xàmpions d''estiu de Manacor 2016'),
    (85,  'ManaCup 2016-17, 1a fase'),
    (86,  'ManaCup 2016-17, 2a fase'),
    (87,  'MiMaM Cup 2016-17'),
    (88,  '3r Campionat de Manacor 2016-17'),
    (98,  'IV Campionat Ciutat de Manacor'),
    (120, 'Cloenda Molins 2018-19'),
    (121, '3a Jornada estiuenca de Scrabble a Badalona'),
    (122, '3a Lligueta Llongueta 2018-19'),
    (125, 'Torneig de Festa Major de Manresa 2019'),
    (126, 'VIII Campionat de Scrabble d''Eivissa'),
    (127, 'Xàmpions d''estiu 2019'),
    (128, 'I Torneig emParaular de Scrabble'),
    (129, '8è Campionat de Scrabble de Sabadell'),
    (130, '1a fase de la Manacup 2019/20'),
    (131, '1r Campionat Xitxarel·lo de Scrabble en Català (el Vendrell)'),
    (132, '2a fase de la Manacup 2019/20'),
    (133, 'Copa de Molins 2019/20'),
    (134, 'I Campionat de la Fitxa Confinada'),
    (135, '2a Lliga i entrenaments de Scrabble clàssic del CS Delta Prat'),
    (136, 'Lligueta Llongueta 2019/20'),
    (137, 'Xàmpions d''estiu 2020'),
    (138, 'Campionat de Scrabble de Molins de Rei, memorial Rafel Canosa'),
    (139, '4a Jornada estiuenca de Scrabble a Badalona'),
    (140, 'Manacup 2020/21')
),
campionats_ AS (
    UPDATE campionats c SET nom = n.nom
    FROM noms n
    WHERE c.primera_edicio = n.edicio AND c.origen = 'arxiu AJUSC'
    RETURNING c.primera_edicio
)
UPDATE barruf_edicions e SET campionats_computats = n.nom
FROM noms n
WHERE e.numero = n.edicio;

COMMIT;
