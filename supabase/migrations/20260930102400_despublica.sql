-- =============================================================================
-- Despublicar l'última edició
-- =============================================================================
-- Per si es detecta un error gros just després de publicar: es desfà l'última
-- edició, es corregeix i es torna a publicar amb el mateix número.
--
--  · Només l'última: despublicar-ne una del mig trencaria la successió.
--  · Mai la llavor ni l'arxiu: la cadena en depèn.
--  · Els campionats que hi havien entrat per primer cop tornen a quedar
--    pendents de publicar, i se n'esborren les variacions.
--  · Queda al registre de canvis (els disparadors de les taules ho apunten).
-- =============================================================================

CREATE OR REPLACE FUNCTION despublica_ultima_edicio(p_numero INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_ultima    barruf_edicions%ROWTYPE;
    v_llavor    INTEGER;
    v_noms      TEXT;
    v_campionats INTEGER;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden despublicar el BARRUF';
    END IF;

    SELECT * INTO v_ultima FROM barruf_edicions ORDER BY numero DESC LIMIT 1;
    SELECT numero INTO v_llavor FROM barruf_edicions WHERE es_llavor;

    -- El número es confirma perquè no se'n despengi una altra per error si
    -- algú ha publicat mentrestant.
    IF v_ultima.numero IS DISTINCT FROM p_numero THEN
        RAISE EXCEPTION 'L''última edició és la %, no la %', v_ultima.numero, p_numero;
    END IF;
    IF v_ultima.es_llavor OR v_ultima.numero <= v_llavor THEN
        RAISE EXCEPTION 'La llavor i les edicions de l''arxiu no es poden despublicar';
    END IF;

    SELECT string_agg(nom, ', ' ORDER BY data), count(*) INTO v_noms, v_campionats
    FROM campionats WHERE primera_edicio = v_ultima.numero;

    -- Les variacions dels campionats que tornen a quedar pendents.
    DELETE FROM barruf_variacions
    WHERE campionat_id IN (SELECT id FROM campionats WHERE primera_edicio = v_ultima.numero);

    UPDATE campionats SET primera_edicio = NULL, modificat_el = now()
    WHERE primera_edicio = v_ultima.numero;

    -- L'estat de cada jugador en aquesta edició se'n va amb ella (ON DELETE CASCADE).
    DELETE FROM barruf_edicions WHERE id = v_ultima.id;

    RETURN jsonb_build_object(
        'numero', v_ultima.numero,
        'campionats', v_campionats,
        'noms', v_noms
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION despublica_ultima_edicio(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION despublica_ultima_edicio(INTEGER) TO authenticated;
