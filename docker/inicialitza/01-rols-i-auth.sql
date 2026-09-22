-- =============================================================================
-- El que Supabase ja porta de sèrie i una instal·lació pròpia no
-- =============================================================================
-- El PostgreSQL oficial no sap res de Supabase. Aquest fitxer crea les peces que
-- l'esquema de l'aplicació dona per fetes: els rols, l'esquema `auth` i les
-- funcions que llegeixen el testimoni de la petició.
--
-- S'executa un sol cop, quan el contenidor crea la base de dades per primera
-- vegada. Si canvieu res d'aquí, heu d'esborrar el volum i tornar a començar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rols
-- -----------------------------------------------------------------------------
-- Són els mateixos noms que fa servir Supabase perquè les polítiques de l'RLS
-- funcionin sense tocar res. `NOLOGIN`: no s'hi entra directament, s'hi arriba
-- perquè PostgREST fa SET ROLE segons el testimoni.
DO $$ BEGIN CREATE ROLE anon NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE ROLE authenticated NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- El rol amb què es connecta PostgREST, que després es transforma en un dels
-- de dalt segons qui faci la petició.
DO $$ BEGIN
    CREATE ROLE autenticador NOINHERIT LOGIN PASSWORD 'canvieu-me';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT anon, authenticated, service_role TO autenticador;

-- -----------------------------------------------------------------------------
-- Esquema auth
-- -----------------------------------------------------------------------------
-- El GoTrue crea les seves taules (`auth.users` i companyia) tot sol quan
-- arrenca. Aquí només es prepara l'esquema i les funcions que Supabase hi
-- afegeix, que són les que fan servir les polítiques de l'RLS.
CREATE SCHEMA IF NOT EXISTS auth;

DO $$ BEGIN CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT CREATEROLE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

/**
 * Les reclamacions del testimoni de la petició.
 *
 * PostgREST desa el contingut del JWT a `request.jwt.claims`. Les versions
 * antigues feien servir `request.jwt.claim.<clau>`; es miren totes dues perquè
 * funcioni amb qualsevol.
 */
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
        '{}'::jsonb
    );
$$;

/** Qui fa la petició, o NULL si no hi ha sessió. */
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(auth.jwt()->>'sub', ''),
        NULLIF(current_setting('request.jwt.claim.sub', true), '')
    )::uuid;
$$;

/** El rol del testimoni: 'anon' o 'authenticated'. */
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(auth.jwt()->>'role', ''),
        NULLIF(current_setting('request.jwt.claim.role', true), '')
    );
$$;

GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid(), auth.role()
    TO anon, authenticated, service_role;
