-- Carrega el bolcat de bolca.sh en una base de dades que ja té l'esquema
-- (totes les migracions aplicades). Substitueix TOTES les dades de public.
--
--   psql "<cadena de connexió>" -v ON_ERROR_STOP=1 -f carrega.sql
--
-- Cal executar-lo des de la carpeta del bolcat (dades.sql i usuaris.sql).
-- Tot va en una sola transacció: si falla res, no canvia res.

\set ON_ERROR_STOP 1
BEGIN;

-- Sense comprovar claus foranes ni disparar triggers mentre es carrega: les
-- dades ja són coherents a l'origen, i el registre de canvis no ha d'apuntar
-- la càrrega. Supabase ho permet a l'usuari postgres.
SET LOCAL session_replication_role = replica;

-- Els comptes dels gestors, abans que els perfils que hi apunten.
\i usuaris.sql

-- Fora les dades que hi han posat les migracions (les llavors).
DO $$
DECLARE t TEXT;
BEGIN
    SELECT string_agg(format('public.%I', tablename), ', ') INTO t
    FROM pg_tables WHERE schemaname = 'public';
    EXECUTE 'TRUNCATE ' || t || ' CASCADE';
END $$;

\i dades.sql

COMMIT;

-- Que l'API s'assabenti de tot.
NOTIFY pgrst, 'reload schema';
