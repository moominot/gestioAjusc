-- =============================================================================
-- Pont amb altres aplicacions (API v1)
-- =============================================================================
-- Per connectar el BARRUF amb una aplicació que gestiona aparellaments,
-- resultats i classificacions:
--
--  · Lectura pública del registre i de la classificació (`api_jugadors`,
--    `api_barruf`), amb els àlies per reconèixer els noms.
--  · Una aplicació amb clau (`connexions`) pot enviar els resultats d'un
--    campionat. No es desen directament: queden a `importacions_rebudes`
--    perquè un gestor els revisi amb l'importador de sempre. Si es tornen a
--    enviar amb el mateix identificador, se substitueix el que hi havia.
--  · Un camp lliure `dades` (JSON) a cada partida i a cada campionat, per a
--    tot el que no té columna pròpia: enllaç a la imatge del full o del
--    tauler, taula, lloc, hora, comentaris...
--
-- L'aplicació no fa servir mai la clau de servei: les funcions de l'API són
-- SECURITY DEFINER i comproven elles mateixes la clau de l'aplicació.

-- --- Dades lliures ----------------------------------------------------------
ALTER TABLE partides   ADD COLUMN IF NOT EXISTS dades JSONB;
ALTER TABLE campionats ADD COLUMN IF NOT EXISTS dades JSONB;
COMMENT ON COLUMN partides.dades IS
    'Dades de la partida sense columna pròpia, en JSON. Camps recomanats: full, tauler (enllaços a imatges), taula, lloc, hora, comentaris.';
COMMENT ON COLUMN campionats.dades IS
    'Dades del campionat sense columna pròpia, en JSON (lloc, web, àrbitre...).';

-- La importació desa també les dades lliures de cada partida.
CREATE OR REPLACE FUNCTION desa_participants_i_partides(
    p_campionat_id  UUID,
    p_origen_alies  TEXT,
    p_participants  JSONB,
    p_partides      JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_participant   JSONB;
    v_jugador_id    UUID;
    v_nom           TEXT;
    v_numero        INTEGER;
    v_correspon     JSONB := '{}'::JSONB;   -- local_id (text) -> uuid (text)
    v_nous          INTEGER := 0;
    v_alies         INTEGER := 0;
    v_partides      INTEGER := 0;
    v_desconegut    TEXT;
BEGIN
    IF jsonb_array_length(p_participants) = 0 THEN
        RAISE EXCEPTION 'El campionat no té cap participant';
    END IF;

    FOR v_participant IN SELECT * FROM jsonb_array_elements(p_participants)
    LOOP
        v_nom := btrim(v_participant->>'nom');
        IF v_nom = '' OR v_nom IS NULL THEN
            RAISE EXCEPTION 'Hi ha un participant sense nom (local_id %)',
                v_participant->>'local_id';
        END IF;

        v_numero := (v_participant->>'jugador_numero')::INTEGER;

        IF v_numero IS NOT NULL THEN
            -- Un jugador fusionat redirigeix cap al bo.
            SELECT COALESCE(fusionat_a, id) INTO v_jugador_id
            FROM jugadors WHERE numero = v_numero;

            IF v_jugador_id IS NULL THEN
                RAISE EXCEPTION 'No existeix cap jugador amb el número %', v_numero;
            END IF;
        ELSE
            INSERT INTO jugadors (nom_complet) VALUES (v_nom)
            RETURNING id INTO v_jugador_id;
            v_nous := v_nous + 1;
        END IF;

        -- El nom tal com surt al fitxer queda registrat com a àlies. Si ja hi
        -- constava (d'aquest jugador o d'un altre) no es toca res.
        INSERT INTO jugador_alies (jugador_id, alies, alies_norm, origen)
        VALUES (v_jugador_id, v_nom, normalitza_nom(v_nom), p_origen_alies)
        ON CONFLICT (alies_norm) DO NOTHING;
        IF FOUND THEN v_alies := v_alies + 1; END IF;

        INSERT INTO inscripcions (campionat_id, jugador_id)
        VALUES (p_campionat_id, v_jugador_id)
        ON CONFLICT DO NOTHING;

        v_correspon := v_correspon
            || jsonb_build_object(v_participant->>'local_id', v_jugador_id::TEXT);
    END LOOP;

    -- Val més plantar-se abans d'inserir que deixar que salti una violació de
    -- NOT NULL, que no diria de quin jugador es tracta.
    SELECT p->>'local_1' INTO v_desconegut
    FROM jsonb_array_elements(p_partides) AS p
    WHERE NOT (v_correspon ? (p->>'local_1'))
    LIMIT 1;
    IF v_desconegut IS NOT NULL THEN
        RAISE EXCEPTION 'Les partides citen el jugador local % , que no surt als participants',
            v_desconegut;
    END IF;

    SELECT p->>'local_2' INTO v_desconegut
    FROM jsonb_array_elements(p_partides) AS p
    WHERE p->>'local_2' IS NOT NULL AND NOT (v_correspon ? (p->>'local_2'))
    LIMIT 1;
    IF v_desconegut IS NOT NULL THEN
        RAISE EXCEPTION 'Les partides citen el jugador local % , que no surt als participants',
            v_desconegut;
    END IF;

    INSERT INTO partides (
        campionat_id, ronda, jugador_1_id, jugador_2_id, resultat_1, punts_1, punts_2,
        scrabbles_1, scrabbles_2,
        mot_1, punts_mot_1, mot_lletra_1, punts_lletra_1,
        mot_2, punts_mot_2, mot_lletra_2, punts_lletra_2, dades
    )
    SELECT
        p_campionat_id,
        (p->>'ronda')::INTEGER,
        (v_correspon->>(p->>'local_1'))::UUID,
        (v_correspon->>(p->>'local_2'))::UUID,
        (p->>'resultat_1')::NUMERIC,
        (p->>'punts_1')::INTEGER,
        (p->>'punts_2')::INTEGER,
        (p->>'scrabbles_1')::INTEGER,
        (p->>'scrabbles_2')::INTEGER,
        NULLIF(p->>'mot_1', ''),
        (p->>'punts_mot_1')::INTEGER,
        NULLIF(p->>'mot_lletra_1', ''),
        (p->>'punts_lletra_1')::INTEGER,
        NULLIF(p->>'mot_2', ''),
        (p->>'punts_mot_2')::INTEGER,
        NULLIF(p->>'mot_lletra_2', ''),
        (p->>'punts_lletra_2')::INTEGER,
        CASE WHEN jsonb_typeof(p->'dades') = 'object' AND p->'dades' <> '{}'::JSONB THEN p->'dades' END
    FROM jsonb_array_elements(p_partides) AS p
    WHERE p->>'local_2' IS NOT NULL;

    GET DIAGNOSTICS v_partides = ROW_COUNT;

    RETURN jsonb_build_object(
        'campionat_id', p_campionat_id,
        'participants', jsonb_array_length(p_participants),
        'jugadors_nous', v_nous,
        'alies_nous', v_alies,
        'partides', v_partides
    );
END;
$$;
-- --- Connexions: les aplicacions amb clau ------------------------------------
CREATE TABLE IF NOT EXISTS connexions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         TEXT NOT NULL CHECK (btrim(nom) <> ''),
    -- Els primers caràcters, per reconèixer-la; la clau sencera no es desa.
    prefix      TEXT NOT NULL,
    clau_hash   TEXT NOT NULL UNIQUE,
    creat_per   UUID DEFAULT auth.uid(),
    creat_el    TIMESTAMPTZ NOT NULL DEFAULT now(),
    darrer_us   TIMESTAMPTZ,
    revocada_el TIMESTAMPTZ
);
ALTER TABLE connexions ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura_gestors ON connexions FOR SELECT USING (es_gestor());
GRANT SELECT ON connexions TO authenticated;

/** Crea una connexió i en torna la clau, que només es veu aquest cop. */
CREATE OR REPLACE FUNCTION crea_connexio(p_nom TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_clau TEXT := 'barruf_' || encode(gen_random_bytes(24), 'hex');
    v_id   UUID;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden crear connexions';
    END IF;
    IF btrim(coalesce(p_nom, '')) = '' THEN
        RAISE EXCEPTION 'Cal un nom per a la connexió';
    END IF;
    INSERT INTO connexions (nom, prefix, clau_hash)
    VALUES (btrim(p_nom), left(v_clau, 14), encode(digest(v_clau, 'sha256'), 'hex'))
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('id', v_id, 'clau', v_clau);
END;
$$;

CREATE OR REPLACE FUNCTION revoca_connexio(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden revocar connexions';
    END IF;
    UPDATE connexions SET revocada_el = now() WHERE id = p_id AND revocada_el IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION crea_connexio(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION revoca_connexio(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crea_connexio(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION revoca_connexio(UUID) TO authenticated;

/** La connexió d'una clau, si és vàlida i no està revocada. */
CREATE OR REPLACE FUNCTION connexio_de_clau(p_clau TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT id FROM connexions
    WHERE clau_hash = encode(digest(coalesce(p_clau, ''), 'sha256'), 'hex') AND revocada_el IS NULL;
$$;
REVOKE EXECUTE ON FUNCTION connexio_de_clau(TEXT) FROM PUBLIC, anon, authenticated;

-- --- Importacions rebudes ------------------------------------------------------
CREATE TABLE IF NOT EXISTS importacions_rebudes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connexio_id     UUID NOT NULL REFERENCES connexions(id),
    -- L'identificador del campionat a l'aplicació que l'envia.
    id_extern       TEXT NOT NULL,
    dades           JSONB NOT NULL,
    versio          INTEGER NOT NULL DEFAULT 1,
    estat           TEXT NOT NULL DEFAULT 'pendent' CHECK (estat IN ('pendent', 'importada', 'descartada')),
    -- El campionat on s'ha importat: les versions següents el tornen a importar.
    campionat_id    UUID REFERENCES campionats(id) ON DELETE SET NULL,
    rebuda_el       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualitzada_el TIMESTAMPTZ NOT NULL DEFAULT now(),
    revisada_el     TIMESTAMPTZ,
    revisada_per    UUID,
    UNIQUE (connexio_id, id_extern)
);
ALTER TABLE importacions_rebudes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura_gestors ON importacions_rebudes FOR SELECT USING (es_gestor());
CREATE POLICY escriptura_gestors ON importacions_rebudes FOR UPDATE USING (es_gestor()) WITH CHECK (es_gestor());
GRANT SELECT, UPDATE ON importacions_rebudes TO authenticated;

/**
 * Rep un campionat d'una aplicació. La forma detallada la comprova l'API
 * abans de cridar-la; aquí es mira la clau i el mínim indispensable.
 */
CREATE OR REPLACE FUNCTION api_rep_importacio(p_clau TEXT, p_dades JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_connexio UUID := connexio_de_clau(p_clau);
    v_extern   TEXT := btrim(p_dades->>'id_extern');
    v_fila     importacions_rebudes%ROWTYPE;
BEGIN
    IF v_connexio IS NULL THEN
        RAISE EXCEPTION 'clau no vàlida' USING ERRCODE = '28000';
    END IF;
    IF coalesce(v_extern, '') = '' THEN
        RAISE EXCEPTION 'Falta id_extern';
    END IF;

    UPDATE connexions SET darrer_us = now() WHERE id = v_connexio;

    INSERT INTO importacions_rebudes (connexio_id, id_extern, dades)
    VALUES (v_connexio, v_extern, p_dades)
    ON CONFLICT (connexio_id, id_extern) DO UPDATE
        SET dades = EXCLUDED.dades,
            versio = importacions_rebudes.versio + 1,
            -- Una versió nova torna a estar per revisar, també si la vella
            -- s'havia importat o descartat.
            estat = 'pendent',
            actualitzada_el = now()
    RETURNING * INTO v_fila;

    RETURN jsonb_build_object(
        'id', v_fila.id, 'id_extern', v_fila.id_extern, 'versio', v_fila.versio,
        'estat', v_fila.estat, 'campionat_id', v_fila.campionat_id
    );
END;
$$;

/** L'estat d'una importació, per a l'aplicació que la va enviar. */
CREATE OR REPLACE FUNCTION api_estat_importacio(p_clau TEXT, p_id_extern TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_connexio UUID := connexio_de_clau(p_clau);
BEGIN
    IF v_connexio IS NULL THEN
        RAISE EXCEPTION 'clau no vàlida' USING ERRCODE = '28000';
    END IF;
    RETURN (
        SELECT jsonb_build_object(
            'id_extern', r.id_extern, 'versio', r.versio, 'estat', r.estat,
            'rebuda_el', r.rebuda_el, 'actualitzada_el', r.actualitzada_el, 'revisada_el', r.revisada_el,
            'campionat_id', r.campionat_id,
            'finalitzat', c.finalitzat,
            'barruf', c.primera_edicio
        )
        FROM importacions_rebudes r LEFT JOIN campionats c ON c.id = r.campionat_id
        WHERE r.connexio_id = v_connexio AND r.id_extern = btrim(p_id_extern)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION api_rep_importacio(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION api_estat_importacio(TEXT, TEXT) TO anon, authenticated;

-- --- Lectura pública -----------------------------------------------------------
/**
 * El registre: tots els jugadors, amb el BARRUF actual i els àlies. Amb un
 * número, només aquell jugador (o el bo, si és un número fusionat).
 */
CREATE OR REPLACE FUNCTION api_jugadors(p_numero INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(x ORDER BY x.numero), '[]'::JSONB) FROM (
        SELECT j.numero, j.nom_complet AS nom, c.nom AS club,
               round(b.barruf) AS barruf, b.categoria, b.estat, b.posicio,
               b.partides_totals AS partides, b.victories_totals AS victories,
               b.darrera_temporada,
               COALESCE((SELECT jsonb_agg(a.alies ORDER BY a.alies) FROM jugador_alies a
                         WHERE a.jugador_id = j.id AND a.alies <> j.nom_complet), '[]'::JSONB) AS alies,
               COALESCE((SELECT jsonb_agg(d.numero ORDER BY d.numero) FROM jugadors d
                         WHERE d.fusionat_a = j.id), '[]'::JSONB) AS numeros_fusionats
        FROM jugadors j
        LEFT JOIN clubs c ON c.id = j.club_id
        LEFT JOIN barruf_classificacio b ON b.jugador_numero = j.numero
        WHERE j.fusionat_a IS NULL
          AND (p_numero IS NULL OR j.numero = p_numero
               OR j.id = (SELECT fusionat_a FROM jugadors WHERE numero = p_numero))
    ) x;
$$;

/** La classificació de l'última edició. */
CREATE OR REPLACE FUNCTION api_barruf()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'edicio', e.numero,
        'data', e.data_publicacio,
        'temporada', e.temporada_codi,
        'jugadors', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'posicio', b.posicio, 'numero', b.jugador_numero, 'nom', b.nom_complet, 'club', b.club,
                'barruf', round(b.barruf), 'categoria', b.categoria, 'estat', b.estat,
                'partides', b.partides_totals, 'victories', b.victories_totals,
                'darrera_temporada', b.darrera_temporada
            ) ORDER BY b.posicio NULLS LAST, b.barruf DESC, b.nom_complet)
            FROM barruf_classificacio b), '[]'::JSONB)
    )
    FROM barruf_ultima_edicio e;
$$;

GRANT EXECUTE ON FUNCTION api_jugadors(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION api_barruf() TO anon, authenticated;
