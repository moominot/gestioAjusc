-- Empremta de les dades, per comparar dues bases de dades (la rèplica i
-- producció): el nombre de files de cada taula de public i un resum de les
-- consultes públiques. Si les dues sortides són iguals, les dades també.
--
--   psql "<connexió>" -At -f compara.sql > empremta.txt

SELECT 'files ' || tablename || ' ' ||
       (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I', tablename), false, true, '')))[1]::text
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

SELECT 'barruf ' || md5(api_barruf()::text);
SELECT 'jugadors ' || md5(api_jugadors()::text);
SELECT 'informe 211 ' || md5(informe_barruf(211)::text);
SELECT 'saló ' || md5(estadistica_salo()::text);
SELECT 'darrera edició ' || max(numero) FROM barruf_edicions;
SELECT 'gestors ' || string_agg(u.email, ',' ORDER BY u.email) FROM perfils p JOIN auth.users u ON u.id = p.id;
