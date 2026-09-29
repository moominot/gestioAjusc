-- =============================================================================
-- Canviar el nom i el club d'un jugador
-- =============================================================================
-- El nom és un atribut, no una clau: es pot corregir quan es vulgui. Però el que
-- arriba de fora es reconeix pels àlies, de manera que en canviar-lo cal:
--
--  · conservar el nom d'abans com a àlies, perquè un full que encara l'escrigui
--    així el continuï reconeixent;
--  · afegir-hi el nou, perquè el reconegui també;
--  · no deixar que el nom nou sigui el d'un altre jugador, que és com es creen
--    duplicats sense adonar-se'n.
--
-- Tot en una funció perquè quedi fet d'un cop o gens.
-- =============================================================================

/**
 * Canvia el nom i el club d'un jugador.
 *
 * `p_club` és el nom curt del club, el que surt a la llista («Manacor»). Si no
 * existeix, es crea. Buit o NULL vol dir sense club.
 */
CREATE OR REPLACE FUNCTION edita_jugador(p_numero INTEGER, p_nom TEXT, p_club TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_jugador  jugadors%ROWTYPE;
    v_nom      TEXT := regexp_replace(btrim(COALESCE(p_nom, '')), '\s+', ' ', 'g');
    v_club     TEXT := NULLIF(regexp_replace(btrim(COALESCE(p_club, '')), '\s+', ' ', 'g'), '');
    v_club_id  UUID;
    v_altre    INTEGER;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden modificar jugadors';
    END IF;

    SELECT * INTO v_jugador FROM jugadors WHERE numero = p_numero;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existeix cap jugador amb el número %', p_numero;
    END IF;
    IF v_jugador.fusionat_a IS NOT NULL THEN
        RAISE EXCEPTION 'Aquesta fitxa està fusionada amb una altra: modifiqueu aquella';
    END IF;
    IF v_nom = '' THEN
        RAISE EXCEPTION 'El nom no pot quedar buit';
    END IF;

    -- El nom nou no pot ser (ni semblar) el d'un altre jugador.
    SELECT j.numero INTO v_altre
    FROM jugador_alies a JOIN jugadors j ON j.id = a.jugador_id
    WHERE a.alies_norm = normalitza_nom(v_nom) AND a.jugador_id <> v_jugador.id
    LIMIT 1;
    IF v_altre IS NOT NULL THEN
        RAISE EXCEPTION 'El nom «%» ja és el del jugador núm. %', v_nom, v_altre;
    END IF;

    IF v_club IS NOT NULL THEN
        SELECT id INTO v_club_id FROM clubs WHERE lower(nom) = lower(v_club);
        IF v_club_id IS NULL THEN
            INSERT INTO clubs (nom) VALUES (v_club) RETURNING id INTO v_club_id;
        END IF;
    END IF;

    -- Els dos noms com a àlies: l'antic per si encara arriba així, el nou perquè
    -- arribarà així. Si ja hi eren, res.
    INSERT INTO jugador_alies (jugador_id, alies, alies_norm, origen) VALUES
        (v_jugador.id, v_jugador.nom_complet, normalitza_nom(v_jugador.nom_complet), 'nom anterior'),
        (v_jugador.id, v_nom, normalitza_nom(v_nom), 'canvi de nom')
    ON CONFLICT (alies_norm) DO NOTHING;

    UPDATE jugadors
    SET nom_complet = v_nom, club_id = v_club_id, modificat_el = now()
    WHERE id = v_jugador.id;

    RETURN jsonb_build_object('numero', p_numero, 'nom', v_nom, 'club', v_club);
END;
$$;

GRANT EXECUTE ON FUNCTION edita_jugador(INTEGER, TEXT, TEXT) TO authenticated;
