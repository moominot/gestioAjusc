-- =============================================================================
-- Gestors i registre de canvis
-- =============================================================================
--  · Un gestor pot donar d'alta un altre gestor amb correu i contrasenya, i
--    donar-lo de baixa. Sense la clau de servei: ho fa una funció de la base de
--    dades que comprova que qui la crida és gestor.
--  · Cada canvi que fa un gestor a les dades queda registrat: qui, quan, què i
--    com era abans i després. Els canvis de les migracions (sense usuari) no.
-- =============================================================================

-- Supabase ja té pgcrypto a l'esquema `extensions`; la rèplica, no.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Els gestors es veuen entre ells (la llista de gestors).
CREATE POLICY lectura_gestors ON perfils FOR SELECT USING (es_gestor());

-- -----------------------------------------------------------------------------
-- Gestors
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION llista_gestors()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN NOT es_gestor() THEN NULL ELSE COALESCE(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nom', p.nom, 'rol', p.rol, 'correu', u.email,
        'creat_el', p.creat_el, 'darrera_entrada', u.last_sign_in_at
    ) ORDER BY p.nom), '[]'::jsonb) END
    FROM perfils p JOIN auth.users u ON u.id = p.id;
$$;

/**
 * Dona d'alta un gestor. Si el correu ja té compte (per exemple, d'un enllaç
 * antic), se li posa la contrasenya i se'l fa gestor.
 */
CREATE OR REPLACE FUNCTION crea_gestor(p_nom TEXT, p_correu TEXT, p_contrasenya TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_correu TEXT := lower(btrim(p_correu));
    v_id     UUID;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden donar d''alta gestors';
    END IF;
    IF btrim(coalesce(p_nom, '')) = '' THEN
        RAISE EXCEPTION 'Cal el nom';
    END IF;
    IF v_correu !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'El correu no és vàlid';
    END IF;
    IF length(coalesce(p_contrasenya, '')) < 8 THEN
        RAISE EXCEPTION 'La contrasenya ha de tenir almenys 8 caràcters';
    END IF;

    SELECT id INTO v_id FROM auth.users WHERE lower(email) = v_correu;

    IF v_id IS NULL THEN
        v_id := gen_random_uuid();
        -- Els camps de testimoni, buits i no nuls: el servidor d'autenticació
        -- no sap llegir-los si són NULL.
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, recovery_token, email_change_token_new, email_change
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
            v_correu, crypt(p_contrasenya, gen_salt('bf', 10)), now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            jsonb_build_object('nom', btrim(p_nom)), now(), now(),
            '', '', '', ''
        );
        INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
        VALUES (
            v_id::text, v_id,
            jsonb_build_object('sub', v_id::text, 'email', v_correu, 'email_verified', true),
            'email', now(), now()
        );
    ELSE
        UPDATE auth.users
        SET encrypted_password = crypt(p_contrasenya, gen_salt('bf', 10)),
            email_confirmed_at = coalesce(email_confirmed_at, now()),
            updated_at = now()
        WHERE id = v_id;
    END IF;

    INSERT INTO perfils (id, nom) VALUES (v_id, btrim(p_nom))
    ON CONFLICT (id) DO UPDATE SET nom = EXCLUDED.nom;

    RETURN jsonb_build_object('id', v_id, 'nom', btrim(p_nom), 'correu', v_correu);
END;
$$;

/** Treu un gestor: deixa de ser-ho, però el compte i el registre es conserven. */
CREATE OR REPLACE FUNCTION treu_gestor(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden treure gestors';
    END IF;
    IF p_id = auth.uid() THEN
        RAISE EXCEPTION 'No us podeu treure a vosaltres mateixos';
    END IF;
    DELETE FROM perfils WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION llista_gestors() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION crea_gestor(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION treu_gestor(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION llista_gestors() TO authenticated;
GRANT EXECUTE ON FUNCTION crea_gestor(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION treu_gestor(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Registre de canvis
-- -----------------------------------------------------------------------------
CREATE TABLE registre_canvis (
    id          BIGSERIAL PRIMARY KEY,
    quan        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Les files d'una mateixa acció (una importació, una publicació) comparteixen transacció.
    transaccio  BIGINT NOT NULL DEFAULT txid_current(),
    usuari_id   UUID,
    usuari      TEXT,
    taula       TEXT NOT NULL,
    operacio    TEXT NOT NULL CHECK (operacio IN ('INSERT', 'UPDATE', 'DELETE')),
    fila_id     TEXT,
    abans       JSONB,
    despres     JSONB
);

CREATE INDEX registre_canvis_quan_idx ON registre_canvis (quan DESC);
CREATE INDEX registre_canvis_transaccio_idx ON registre_canvis (transaccio);

ALTER TABLE registre_canvis ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura_gestors ON registre_canvis FOR SELECT USING (es_gestor());

CREATE OR REPLACE FUNCTION registra_canvi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_usuari UUID := auth.uid();
    v_abans  JSONB;
    v_despres JSONB;
BEGIN
    -- Les migracions i els processos sense usuari no s'apunten.
    IF v_usuari IS NULL THEN
        RETURN NULL;
    END IF;

    v_abans := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
    v_despres := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    -- Una actualització que no canvia res no s'apunta.
    IF TG_OP = 'UPDATE' AND v_abans = v_despres THEN
        RETURN NULL;
    END IF;

    INSERT INTO registre_canvis (usuari_id, usuari, taula, operacio, fila_id, abans, despres)
    VALUES (
        v_usuari,
        (SELECT nom FROM perfils WHERE id = v_usuari),
        TG_TABLE_NAME,
        TG_OP,
        coalesce(v_despres, v_abans) ->> 'id',
        v_abans,
        v_despres
    );
    RETURN NULL;
END;
$$;

-- Les taules que toquen els gestors. Els valors i variacions del BARRUF no:
-- una publicació en reescriu centenars i ja queda apuntada per l'edició nova.
DO $$
DECLARE
    v_taula TEXT;
BEGIN
    FOREACH v_taula IN ARRAY ARRAY[
        'campionats', 'inscripcions', 'partides', 'jugadors', 'jugador_alies', 'clubs',
        'quotes', 'perfils', 'barruf_edicions', 'jugadors_no_duplicats', 'temporades'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER registra_canvis AFTER INSERT OR UPDATE OR DELETE ON %I
             FOR EACH ROW EXECUTE FUNCTION registra_canvi()', v_taula);
    END LOOP;
END;
$$;

/**
 * Les darreres accions, agrupades per transacció: qui, quan, i quantes files
 * de cada taula s'hi van crear, modificar o esborrar, amb el detall de les
 * primeres.
 */
CREATE OR REPLACE FUNCTION registre_recent(p_limit INTEGER DEFAULT 50, p_abans_de BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH accions AS (
        SELECT transaccio, min(quan) AS quan, max(usuari) AS usuari, min(id) AS primer
        FROM registre_canvis
        WHERE p_abans_de IS NULL OR id < p_abans_de
        GROUP BY transaccio
        ORDER BY min(id) DESC
        LIMIT least(coalesce(p_limit, 50), 200)
    )
    SELECT CASE WHEN NOT es_gestor() THEN NULL ELSE COALESCE(jsonb_agg(jsonb_build_object(
        'transaccio', a.transaccio,
        'quan', a.quan,
        'usuari', a.usuari,
        'primer', a.primer,
        'resum', (
            SELECT jsonb_agg(jsonb_build_object('taula', taula, 'operacio', operacio, 'files', n) ORDER BY taula, operacio)
            FROM (SELECT taula, operacio, count(*) AS n FROM registre_canvis r
                  WHERE r.transaccio = a.transaccio GROUP BY taula, operacio) x
        ),
        'detall', (
            SELECT jsonb_agg(jsonb_build_object(
                'taula', r.taula, 'operacio', r.operacio, 'abans', r.abans, 'despres', r.despres
            ) ORDER BY r.id)
            FROM (SELECT * FROM registre_canvis r WHERE r.transaccio = a.transaccio ORDER BY r.id LIMIT 20) r
        )
    ) ORDER BY a.primer DESC), '[]'::jsonb) END
    FROM accions a;
$$;

REVOKE EXECUTE ON FUNCTION registre_recent(INTEGER, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registre_recent(INTEGER, BIGINT) TO authenticated;
