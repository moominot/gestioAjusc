-- =============================================================================
-- Fitxa completa del jugador, per als gestors
-- =============================================================================
-- El nom al BARRUF (`nom_complet`) és el que surt a les llistes. A banda, la
-- fitxa té el nom i els cognoms reals, el contacte, la data de naixement, el
-- club, unes notes internes i els àlies (les maneres en què s'ha vist escrit
-- el nom als fitxers de resultats). Les dades de contacte només les veuen els
-- gestors: les polítiques RLS de `jugadors` ja ho fan així.
-- =============================================================================

ALTER TABLE jugadors ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN jugadors.nom_complet IS 'Nom tal com surt al BARRUF i a totes les llistes.';
COMMENT ON COLUMN jugadors.notes IS 'Notes internes dels gestors. No es publiquen.';

/** Tot el que la gestió necessita per editar un jugador. */
CREATE OR REPLACE FUNCTION fitxa_jugador_gestio(p_numero INTEGER)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN NOT es_gestor() THEN NULL ELSE (
        SELECT jsonb_build_object(
            'numero', j.numero,
            'nom_complet', j.nom_complet,
            'nom', j.nom,
            'cognoms', j.cognoms,
            'email', j.email,
            'telefon', j.telefon,
            'data_naixement', j.data_naixement,
            'notes', j.notes,
            'club', c.nom,
            'fusionat_a', (SELECT b.numero FROM jugadors b WHERE b.id = j.fusionat_a),
            'creat_el', j.creat_el,
            'modificat_el', j.modificat_el,
            'alies', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', a.id, 'alies', a.alies, 'origen', a.origen
                ) ORDER BY a.alies), '[]'::jsonb)
                FROM jugador_alies a WHERE a.jugador_id = j.id
            )
        )
        FROM jugadors j LEFT JOIN clubs c ON c.id = j.club_id
        WHERE j.numero = p_numero
    ) END;
$$;

/**
 * Desa la fitxa. El nom al BARRUF i el club passen per `edita_jugador`, que
 * en conserva l'àlies i no deixa posar el nom d'un altre jugador.
 */
CREATE OR REPLACE FUNCTION desa_jugador(p_numero INTEGER, p_dades JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_email TEXT := NULLIF(btrim(p_dades->>'email'), '');
    v_resultat JSONB;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden modificar jugadors';
    END IF;
    IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'El correu «%» no és vàlid', v_email;
    END IF;

    v_resultat := edita_jugador(p_numero, p_dades->>'nom_complet', p_dades->>'club');

    UPDATE jugadors SET
        nom = NULLIF(btrim(p_dades->>'nom'), ''),
        cognoms = NULLIF(btrim(p_dades->>'cognoms'), ''),
        email = lower(v_email),
        telefon = NULLIF(btrim(p_dades->>'telefon'), ''),
        data_naixement = NULLIF(p_dades->>'data_naixement', '')::DATE,
        notes = NULLIF(btrim(p_dades->>'notes'), ''),
        modificat_el = now()
    WHERE numero = p_numero;

    RETURN v_resultat;
END;
$$;

/** Afegeix un àlies. Si ja és d'un altre jugador, ho diu. */
CREATE OR REPLACE FUNCTION afegeix_alies(p_numero INTEGER, p_alies TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id    UUID;
    v_alies TEXT := regexp_replace(btrim(coalesce(p_alies, '')), '\s+', ' ', 'g');
    v_altre INTEGER;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden modificar jugadors';
    END IF;
    IF v_alies = '' THEN
        RAISE EXCEPTION 'L''àlies no pot ser buit';
    END IF;
    SELECT id INTO v_id FROM jugadors WHERE numero = p_numero;
    SELECT j.numero INTO v_altre
    FROM jugador_alies a JOIN jugadors j ON j.id = a.jugador_id
    WHERE a.alies_norm = normalitza_nom(v_alies);
    IF v_altre IS NOT NULL AND v_altre <> p_numero THEN
        RAISE EXCEPTION '«%» ja és un àlies del jugador núm. %', v_alies, v_altre;
    END IF;
    INSERT INTO jugador_alies (jugador_id, alies, alies_norm, origen)
    VALUES (v_id, v_alies, normalitza_nom(v_alies), 'afegit a mà')
    ON CONFLICT (alies_norm) DO NOTHING;
END;
$$;

/**
 * Treu un àlies. El del nom actual no es pot treure: les importacions no
 * reconeixerien el jugador pel seu propi nom.
 */
CREATE OR REPLACE FUNCTION treu_alies(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden modificar jugadors';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jugador_alies a JOIN jugadors j ON j.id = a.jugador_id
        WHERE a.id = p_id AND a.alies_norm = normalitza_nom(j.nom_complet)
    ) THEN
        RAISE EXCEPTION 'Aquest àlies és el nom actual del jugador i no es pot treure';
    END IF;
    DELETE FROM jugador_alies WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION fitxa_jugador_gestio(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fitxa_jugador_gestio(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION desa_jugador(INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION afegeix_alies(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION treu_alies(UUID) TO authenticated;
