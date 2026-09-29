-- =============================================================================
-- El que cal per publicar el BARRUF en PDF
-- =============================================================================
-- El PDF de l'AJUSC porta tres coses que fins ara no es desaven:
--
--  · L'ordre de la llista del full. Els empatats a BARRUF surten sempre en
--    l'ordre de les files del full, que es conserva d'una edició a l'altra i al
--    qual els jugadors nous s'afegeixen al final. Sense això l'ordre dels
--    empats seria arbitrari i els PDF no quadrarien línia per línia.
--  · El nom llarg dels clubs, per a la llegenda del final de la llista.
--  · Per a cada edició, quins campionats hi entren per primer cop i els totals
--    acumulats de la capçalera («49.316 resultats individuals anotats i 275
--    campionats o fases computats»).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ordre de la llista
-- -----------------------------------------------------------------------------
CREATE SEQUENCE ordre_llista_seq START 1;

ALTER TABLE jugadors
    ADD COLUMN ordre_llista INTEGER NOT NULL DEFAULT nextval('ordre_llista_seq');

-- ADD COLUMN amb DEFAULT volàtil omple cada fila existent amb un valor de la
-- seqüència, però en un ordre qualsevol. El de la llavor és l'alfabètic del
-- número; el relleu de llavor el substitueix per l'ordre real del full.
UPDATE jugadors SET ordre_llista = numero;
SELECT setval('ordre_llista_seq', GREATEST((SELECT max(ordre_llista) FROM jugadors), 1));

GRANT USAGE ON SEQUENCE ordre_llista_seq TO authenticated;

COMMENT ON COLUMN jugadors.ordre_llista IS
    'Posició a la llista del full de l''AJUSC. Desempata els iguals a BARRUF.';

-- -----------------------------------------------------------------------------
-- Llegenda dels clubs
-- -----------------------------------------------------------------------------
ALTER TABLE clubs ADD COLUMN nom_llegenda TEXT;

COMMENT ON COLUMN clubs.nom_llegenda IS
    'Nom sencer per a la llegenda del BARRUF. Només hi surten els que en tenen.';

INSERT INTO clubs (nom, nom_llegenda) VALUES
    ('Ateneu',       'GS Barcelona Ateneu'),
    ('Badalona',     'Scrabble Badalona'),
    ('Canet',        'CS Canet de Mar'),
    ('CASC',         'Club d’Amics de l’Scrabble en català'),
    ('Cerdanyola',   'CS Cerdanyola del Vallès'),
    ('Delta Prat',   'CS Delta Prat'),
    ('Eivissa',      'CS Eivissa'),
    ('Gràcia',       'GS Gràcia-Cassoles'),
    ('l''Hospitalet', 'CS l’Hescarràs, l’Hospitalet'),
    ('Manacor',      'CS Manacor'),
    ('Manresa',      'CS Manresa'),
    ('Matadepera',   'GS Matadepera'),
    ('MiMaM',        'Mots i Més a Molins'),
    ('Palma',        'CS Palma'),
    ('el Prat',      'CS el Prat de Llobregat'),
    ('Queimada',     'CS Queimada'),
    ('Sabadell',     'CS Sabadell'),
    ('SACS',         'CS Sant Andreu de Palomar'),
    ('St. Andreu',   'CS Sant Andreu de la Barca'),
    ('UF',           'Unió Faristolaire'),
    ('el Vendrell',  'Sac de Mots del Vendrell')
ON CONFLICT (nom) DO UPDATE SET nom_llegenda = EXCLUDED.nom_llegenda;

-- -----------------------------------------------------------------------------
-- Campionats de cada edició i totals acumulats
-- -----------------------------------------------------------------------------
ALTER TABLE campionats ADD COLUMN primera_edicio INTEGER;

COMMENT ON COLUMN campionats.primera_edicio IS
    'Número de la primera edició del BARRUF que el va computar.';

ALTER TABLE barruf_edicions
    ADD COLUMN campionats_computats TEXT,
    ADD COLUMN resultats_acumulats  INTEGER,
    ADD COLUMN campionats_acumulats INTEGER;

COMMENT ON COLUMN barruf_edicions.campionats_computats IS
    'Els campionats que entren per primer cop en aquesta edició, tal com surten a la capçalera.';
COMMENT ON COLUMN barruf_edicions.resultats_acumulats IS
    'Resultats individuals anotats des de l''any 2000: cada partida en compta dos.';

/**
 * Desa una edició nova del BARRUF.
 *
 * Igual que la versió anterior, i a més marca els campionats que hi entren per
 * primer cop i n'acumula els totals de la capçalera. Tot es fa aquí i no al
 * client perquè ha de ser coherent amb el que queda desat.
 */
CREATE OR REPLACE FUNCTION publica_edicio(
    p_edicio      JSONB,
    p_valors      JSONB,
    p_variacions  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_edicio_id  UUID;
    v_numero     INTEGER;
    v_valors     INTEGER;
    v_variacions INTEGER;
    v_orfe       TEXT;
    v_anterior   barruf_edicions%ROWTYPE;
    v_noms       TEXT;
    v_nous       INTEGER;
    v_resultats  INTEGER;
BEGIN
    IF NOT es_gestor() THEN
        RAISE EXCEPTION 'Només els gestors poden publicar el BARRUF';
    END IF;

    v_numero := (p_edicio->>'numero')::INTEGER;
    IF v_numero IS NULL THEN
        RAISE EXCEPTION 'L''edició necessita un número';
    END IF;

    IF EXISTS (SELECT 1 FROM barruf_edicions WHERE numero = v_numero) THEN
        RAISE EXCEPTION 'El BARRUF % ja està publicat', v_numero;
    END IF;

    -- Cap número pot anar enrere: la cadena és una successió.
    IF v_numero <= (SELECT COALESCE(max(numero), 0) FROM barruf_edicions) THEN
        RAISE EXCEPTION 'El BARRUF % és anterior a l''última edició publicada', v_numero;
    END IF;

    SELECT v->>'jugador_numero' INTO v_orfe
    FROM jsonb_array_elements(p_valors) AS v
    WHERE NOT EXISTS (
        SELECT 1 FROM jugadors j WHERE j.numero = (v->>'jugador_numero')::INTEGER
    )
    LIMIT 1;
    IF v_orfe IS NOT NULL THEN
        RAISE EXCEPTION 'No existeix cap jugador amb el número %', v_orfe;
    END IF;

    -- Els campionats de la cadena que cap edició no havia computat encara.
    SELECT
        string_agg(c.nom, ', ' ORDER BY c.data, c.ordre),
        count(*),
        COALESCE(sum((
            SELECT count(*) FROM partides p
            WHERE p.campionat_id = c.id AND p.jugador_2_id IS NOT NULL
        )), 0) * 2
    INTO v_noms, v_nous, v_resultats
    FROM campionats c
    WHERE c.computa_barruf AND c.finalitzat AND c.primera_edicio IS NULL;

    SELECT * INTO v_anterior FROM barruf_edicions ORDER BY numero DESC LIMIT 1;

    INSERT INTO barruf_edicions (
        numero, data_publicacio, temporada_codi, descripcio,
        campionats_computats, resultats_acumulats, campionats_acumulats
    )
    VALUES (
        v_numero,
        COALESCE((p_edicio->>'data_publicacio')::DATE, CURRENT_DATE),
        p_edicio->>'temporada_codi',
        NULLIF(p_edicio->>'descripcio', ''),
        v_noms,
        v_anterior.resultats_acumulats + v_resultats,
        v_anterior.campionats_acumulats + v_nous
    )
    RETURNING id INTO v_edicio_id;

    UPDATE campionats SET primera_edicio = v_numero
    WHERE computa_barruf AND finalitzat AND primera_edicio IS NULL;

    INSERT INTO barruf_valors (
        edicio_id, jugador_id, barruf,
        partides_totals, victories_totals, partides_temporada, victories_temporada,
        estat, darrera_temporada, cohort_llegat, debutant, posicio
    )
    SELECT
        v_edicio_id,
        j.id,
        (v->>'barruf')::NUMERIC,
        (v->>'partides_totals')::INTEGER,
        (v->>'victories_totals')::NUMERIC,
        (v->>'partides_temporada')::INTEGER,
        (v->>'victories_temporada')::NUMERIC,
        (v->>'estat')::estat_jugador,
        v->>'darrera_temporada',
        COALESCE((v->>'cohort_llegat')::BOOLEAN, FALSE),
        COALESCE((v->>'debutant')::BOOLEAN, FALSE),
        (v->>'posicio')::INTEGER
    FROM jsonb_array_elements(p_valors) AS v
    JOIN jugadors j ON j.numero = (v->>'jugador_numero')::INTEGER;

    GET DIAGNOSTICS v_valors = ROW_COUNT;

    -- Les variacions es refan senceres a cada publicació.
    DELETE FROM barruf_variacions;

    INSERT INTO barruf_variacions (
        campionat_id, jugador_id, barruf_abans, partides, victories,
        esperanca, factor_k, variacio, barruf_despres
    )
    SELECT
        (v->>'campionat_id')::UUID,
        j.id,
        (v->>'barruf_abans')::NUMERIC,
        (v->>'partides')::INTEGER,
        (v->>'victories')::NUMERIC,
        (v->>'esperanca')::NUMERIC,
        (v->>'factor_k')::INTEGER,
        (v->>'variacio')::NUMERIC,
        (v->>'barruf_despres')::NUMERIC
    FROM jsonb_array_elements(p_variacions) AS v
    JOIN jugadors j ON j.numero = (v->>'jugador_numero')::INTEGER;

    GET DIAGNOSTICS v_variacions = ROW_COUNT;

    RETURN jsonb_build_object(
        'edicio_id', v_edicio_id,
        'numero', v_numero,
        'valors', v_valors,
        'variacions', v_variacions
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- Les dades del PDF
-- -----------------------------------------------------------------------------
/**
 * Tot el que porta el PDF d'una edició, en una sola consulta.
 *
 * Cada fila porta també els valors de l'edició anterior, que és d'on surten la
 * variació de posició, la progressió i les victòries i partides des de
 * l'anterior BARRUF. Sense `p_numero`, l'última edició.
 *
 * S'executa amb els permisos del propietari, com les vistes públiques, i
 * retorna només el que ja és públic: res de contacte ni de quotes.
 */
CREATE OR REPLACE FUNCTION informe_barruf(p_numero INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH edicio AS (
        SELECT * FROM barruf_edicions
        WHERE numero = COALESCE(p_numero, (SELECT max(numero) FROM barruf_edicions))
    ),
    anterior AS (
        SELECT * FROM barruf_edicions
        WHERE numero < (SELECT numero FROM edicio)
        ORDER BY numero DESC LIMIT 1
    )
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM edicio) THEN NULL ELSE jsonb_build_object(
        'edicio', (SELECT jsonb_build_object(
            'numero', e.numero,
            'data_publicacio', e.data_publicacio,
            'temporada', e.temporada_codi,
            'campionats_computats', e.campionats_computats,
            'resultats_acumulats', e.resultats_acumulats,
            'campionats_acumulats', e.campionats_acumulats
        ) FROM edicio e),
        'anterior', (SELECT numero FROM anterior),
        'files', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'numero', j.numero,
                'nom', j.nom_complet,
                'club', c.nom,
                'ordre', j.ordre_llista,
                'barruf', v.barruf,
                'estat', v.estat,
                'posicio', v.posicio,
                'debutant', v.debutant,
                'partides_totals', v.partides_totals,
                'victories_totals', v.victories_totals,
                'partides_temporada', v.partides_temporada,
                'victories_temporada', v.victories_temporada,
                'anterior', CASE WHEN a.jugador_id IS NULL THEN NULL ELSE jsonb_build_object(
                    'barruf', a.barruf,
                    'estat', a.estat,
                    'posicio', a.posicio,
                    'partides_totals', a.partides_totals,
                    'victories_totals', a.victories_totals
                ) END
            )), '[]'::jsonb)
            FROM barruf_valors v
            JOIN edicio e ON e.id = v.edicio_id
            JOIN jugadors j ON j.id = v.jugador_id
            LEFT JOIN clubs c ON c.id = j.club_id
            LEFT JOIN barruf_valors a
                ON a.jugador_id = v.jugador_id
               AND a.edicio_id = (SELECT id FROM anterior)
            WHERE j.fusionat_a IS NULL
        ),
        'clubs', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'nom', nom, 'nom_llegenda', nom_llegenda
            )), '[]'::jsonb)
            FROM clubs WHERE nom_llegenda IS NOT NULL
        )
    ) END;
$$;

GRANT EXECUTE ON FUNCTION informe_barruf(INTEGER) TO anon, authenticated;
