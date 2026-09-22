-- =============================================================================
-- AJUSC — Esquema del nucli del BARRUF
-- =============================================================================
-- Principi rector: els resultats són l'única font de veritat. El BARRUF és una
-- projecció derivada i sempre recalculable rejugant la cadena de campionats en
-- ordre. Cap valor de BARRUF s'edita mai a mà.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Perfils i rols (autenticació)
-- -----------------------------------------------------------------------------

CREATE TYPE rol_usuari AS ENUM ('gestor', 'admin');

CREATE TABLE perfils (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nom         TEXT NOT NULL,
    rol         rol_usuari NOT NULL DEFAULT 'gestor',
    creat_el    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE perfils IS
    'Gestors del club. Qui no hi surt només té accés de lectura pública.';

-- Funció auxiliar per a les polítiques RLS. SECURITY DEFINER per poder llegir
-- perfils sense caure en recursió de polítiques.
CREATE OR REPLACE FUNCTION es_gestor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM perfils WHERE id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Clubs i temporades
-- -----------------------------------------------------------------------------

CREATE TABLE clubs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom         TEXT NOT NULL UNIQUE,
    poblacio    TEXT,
    adherit     BOOLEAN NOT NULL DEFAULT TRUE,
    actiu       BOOLEAN NOT NULL DEFAULT TRUE,
    creat_el    TIMESTAMPTZ NOT NULL DEFAULT now(),
    modificat_el TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN clubs.adherit IS 'Si el club o grup de joc està adherit a l''AJUSC.';

CREATE TABLE temporades (
    -- Codi natural: '2025-26'. És l'identificador que fa servir tothom.
    codi        TEXT PRIMARY KEY CHECK (codi ~ '^\d{4}-\d{2}$'),
    -- Any d'inici, desnormalitzat per poder comparar temporades amb enters.
    any_inici   INTEGER NOT NULL,
    data_inici  DATE NOT NULL,
    data_fi     DATE NOT NULL,
    CHECK (data_fi > data_inici)
);

COMMENT ON TABLE temporades IS
    'La temporada va de setembre a agost. El barrat d''inactivitat s''aplica al canvi de temporada.';

-- -----------------------------------------------------------------------------
-- Jugadors: identitat estable i immutable
-- -----------------------------------------------------------------------------

CREATE SEQUENCE numero_jugador_seq START 1;

CREATE TABLE jugadors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identificador públic: curt, llegible, assignat un cop i MAI reutilitzat.
    -- És el que surt a les llistes publicades i el que la gent pot citar.
    numero          INTEGER NOT NULL UNIQUE DEFAULT nextval('numero_jugador_seq'),

    -- Nom tal com apareix a les llistes del BARRUF. És un atribut, mai una clau.
    nom_complet     TEXT NOT NULL,
    -- Camps estructurats opcionals, per al registre de socis.
    nom             TEXT,
    cognoms         TEXT,

    club_id         UUID REFERENCES clubs(id) ON DELETE SET NULL,

    -- Dades de contacte (només visibles per als gestors: vegeu les polítiques RLS)
    email           TEXT,
    telefon         TEXT,
    data_naixement  DATE,

    -- Fusió de duplicats: els jugadors no s'esborren mai. Si es descobreix que
    -- dues fitxes són la mateixa persona, la dolenta apunta a la bona i les
    -- referències històriques continuen resolent.
    fusionat_a      UUID REFERENCES jugadors(id) ON DELETE RESTRICT,

    creat_el        TIMESTAMPTZ NOT NULL DEFAULT now(),
    modificat_el    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (fusionat_a IS NULL OR fusionat_a <> id)
);

CREATE INDEX jugadors_fusionat_a_idx ON jugadors(fusionat_a) WHERE fusionat_a IS NOT NULL;
CREATE INDEX jugadors_club_idx ON jugadors(club_id);

COMMENT ON COLUMN jugadors.numero IS
    'Número públic de jugador. Assignat un cop, mai reutilitzat ni reassignat.';

-- Cada forma en què s'ha vist escrit el nom d'un jugador als resultats que
-- arriben de fora. Cada importació fa la resolució de noms més fiable.
CREATE TABLE jugador_alies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jugador_id      UUID NOT NULL REFERENCES jugadors(id) ON DELETE CASCADE,
    alies           TEXT NOT NULL,
    -- Forma normalitzada (minúscules, sense accents ni espais sobrers) per cercar.
    alies_norm      TEXT NOT NULL,
    origen          TEXT,
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (alies_norm)
);

CREATE INDEX jugador_alies_jugador_idx ON jugador_alies(jugador_id);

-- -----------------------------------------------------------------------------
-- Socis i quotes
-- -----------------------------------------------------------------------------

CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jugador_id      UUID NOT NULL REFERENCES jugadors(id) ON DELETE CASCADE,
    exercici        INTEGER NOT NULL,
    import          NUMERIC(10,2) NOT NULL CHECK (import >= 0),
    pagada          BOOLEAN NOT NULL DEFAULT FALSE,
    data_pagament   DATE,
    metode          TEXT,
    notes           TEXT,
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT now(),
    modificat_el    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (jugador_id, exercici),
    CHECK (NOT pagada OR data_pagament IS NOT NULL)
);

COMMENT ON TABLE quotes IS
    'Ser soci és haver pagat la quota de l''exercici. No hi ha cap booleà "es_soci":
     es dedueix d''aquesta taula, que és l''única font de veritat.';

-- -----------------------------------------------------------------------------
-- Campionats i resultats
-- -----------------------------------------------------------------------------

CREATE TABLE campionats (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom                 TEXT NOT NULL,
    data                DATE NOT NULL,
    temporada_codi      TEXT NOT NULL REFERENCES temporades(codi),

    organitzador        TEXT,
    club_organitzador_id UUID REFERENCES clubs(id) ON DELETE SET NULL,

    -- ---------------------------------------------------------------------
    -- LA BANDERA CRÍTICA
    -- ---------------------------------------------------------------------
    -- TRUE  → el campionat entra a la cadena i mou el BARRUF de tothom.
    -- FALSE → campionat d'arxiu: es pot consultar, dona estadístiques i
    --         històric d'enfrontaments, però NO toca cap BARRUF.
    --
    -- Els campionats anteriors al punt de partida s'importen amb FALSE. Si
    -- algú els posés a TRUE, es recalcularia la cadena sencera i es mourien
    -- tots els BARRUF publicats.
    computa_barruf      BOOLEAN NOT NULL DEFAULT TRUE,
    motiu_no_computa    TEXT,

    /*
     * Un campionat es barrufa quan s'acaba, mai per trams. Mentre estigui en
     * curs es pot importar i consultar, i se'n pot simular l'efecte, però no
     * entra a la cadena.
     *
     * La cadena, doncs, es construeix amb `computa_barruf AND finalitzat`.
     */
    finalitzat          BOOLEAN NOT NULL DEFAULT FALSE,

    /* Per veure d'un cop d'ull si el que s'ha importat és tot el campionat. */
    rondes_previstes    INTEGER,
    rondes_jugades      INTEGER,

    -- Desempat de l'ordre de la cadena quan dos campionats són el mateix dia.
    ordre               INTEGER NOT NULL DEFAULT 0,

    -- Procedència de les dades: 'swissperfect', 'spde', 'manual', 'arxiu'
    origen              TEXT,
    notes               TEXT,

    creat_el            TIMESTAMPTZ NOT NULL DEFAULT now(),
    modificat_el        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (computa_barruf OR motiu_no_computa IS NOT NULL)
);

-- L'ordre de la cadena ha de ser total i determinista.
CREATE UNIQUE INDEX campionats_ordre_cadena_idx ON campionats(data, ordre);
CREATE INDEX campionats_temporada_idx ON campionats(temporada_codi);
CREATE INDEX campionats_computa_idx ON campionats(computa_barruf) WHERE computa_barruf;

-- Participants. Cal desar-los a part de les partides: un jugador es pot
-- inscriure i no jugar cap partida, i llavors no li varia el BARRUF.
CREATE TABLE inscripcions (
    campionat_id    UUID NOT NULL REFERENCES campionats(id) ON DELETE CASCADE,
    jugador_id      UUID NOT NULL REFERENCES jugadors(id) ON DELETE RESTRICT,
    PRIMARY KEY (campionat_id, jugador_id)
);

CREATE TABLE partides (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campionat_id    UUID NOT NULL REFERENCES campionats(id) ON DELETE CASCADE,
    ronda           INTEGER NOT NULL CHECK (ronda > 0),

    jugador_1_id    UUID NOT NULL REFERENCES jugadors(id) ON DELETE RESTRICT,
    -- NULL = BYE. Les partides amb BYE no compten per al BARRUF.
    jugador_2_id    UUID REFERENCES jugadors(id) ON DELETE RESTRICT,

    -- Resultat que fa servir el motor: 1 = victòria, 0.5 = empat, 0 = derrota.
    resultat_1      NUMERIC(2,1) NOT NULL CHECK (resultat_1 IN (0, 0.5, 1)),

    -- Puntuació d'Scrabble, opcional: hi ha campionats dels quals només ens
    -- arriba el resultat. Serveix per a estadístiques, no per al BARRUF.
    punts_1         INTEGER,
    punts_2         INTEGER,
    scrabbles_1     INTEGER,
    scrabbles_2     INTEGER,

    creat_el        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (jugador_2_id IS NULL OR jugador_1_id <> jugador_2_id),
    -- Un BYE sempre es desa com a victòria del jugador present.
    CHECK (jugador_2_id IS NOT NULL OR resultat_1 = 1)
);

CREATE INDEX partides_campionat_idx ON partides(campionat_id);
CREATE INDEX partides_jugador_1_idx ON partides(jugador_1_id);
CREATE INDEX partides_jugador_2_idx ON partides(jugador_2_id);

-- Cap jugador pot aparèixer dues vegades a la mateixa ronda del mateix
-- campionat, sigui a la banda que sigui. Amb dos índexs únics no n'hi ha prou
-- (un jugador podria ser j1 en una fila i j2 en una altra), per això cal el
-- disparador.
CREATE OR REPLACE FUNCTION comprova_jugador_unic_per_ronda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    duplicat UUID;
BEGIN
    SELECT j INTO duplicat
    FROM (VALUES (NEW.jugador_1_id), (NEW.jugador_2_id)) AS v(j)
    WHERE j IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM partides p
          WHERE p.campionat_id = NEW.campionat_id
            AND p.ronda = NEW.ronda
            AND p.id <> NEW.id
            AND (p.jugador_1_id = v.j OR p.jugador_2_id = v.j)
      )
    LIMIT 1;

    IF duplicat IS NOT NULL THEN
        RAISE EXCEPTION
            'El jugador % ja té una partida a la ronda % del campionat %',
            duplicat, NEW.ronda, NEW.campionat_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER partides_jugador_unic_per_ronda
    AFTER INSERT OR UPDATE ON partides
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION comprova_jugador_unic_per_ronda();

-- -----------------------------------------------------------------------------
-- El BARRUF: edicions publicades i valors
-- -----------------------------------------------------------------------------

CREATE TYPE estat_jugador AS ENUM ('nov', 'exp', 'act', 'inact');

COMMENT ON TYPE estat_jugador IS
    'nov: encara no ha jugat cap partida. exp: 10 partides o menys, BARRUF provisional.
     act: més de 10 partides i ha jugat dins les 2 darreres temporades.
     inact: més de 2 temporades sense jugar.';

CREATE TABLE barruf_edicions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero          INTEGER NOT NULL UNIQUE,
    data_publicacio DATE NOT NULL,
    temporada_codi  TEXT NOT NULL REFERENCES temporades(codi),

    -- L'edició llavor és el punt zero: valors heretats del full de càlcul, sense
    -- partides al darrere. No es pot recalcular i és l'origen de tota la cadena.
    es_llavor       BOOLEAN NOT NULL DEFAULT FALSE,

    -- Versió de les regles amb què es va calcular, per poder justificar
    -- qualsevol número històric si les bases canvien.
    regla_versio    TEXT NOT NULL DEFAULT '2000-01',

    descripcio      TEXT,
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Només pot haver-hi una edició llavor.
CREATE UNIQUE INDEX barruf_una_sola_llavor ON barruf_edicions((es_llavor)) WHERE es_llavor;

CREATE TABLE barruf_valors (
    edicio_id           UUID NOT NULL REFERENCES barruf_edicions(id) ON DELETE CASCADE,
    jugador_id          UUID NOT NULL REFERENCES jugadors(id) ON DELETE CASCADE,

    -- Sense arrodonir: l'arrodoniment és cosa de la publicació, no de la cadena.
    barruf              NUMERIC(10,4) NOT NULL,

    partides_totals     INTEGER NOT NULL DEFAULT 0,
    victories_totals    NUMERIC(6,1) NOT NULL DEFAULT 0,
    partides_temporada  INTEGER NOT NULL DEFAULT 0,
    victories_temporada NUMERIC(6,1) NOT NULL DEFAULT 0,

    estat               estat_jugador NOT NULL,
    darrera_temporada   TEXT REFERENCES temporades(codi),

    /*
     * Cohort anterior al 2014-15: va jugar, però no se'n conserva la temporada
     * concreta. Només apareix a la llavor; tot el que entri d'ara endavant
     * sempre porta temporada.
     */
    cohort_llegat       BOOLEAN NOT NULL DEFAULT FALSE,

    /* Debuta aquesta temporada. Derivable un cop hi ha cadena; a la llavor
     * s'importa tal com surt a la llista publicada. */
    debutant            BOOLEAN NOT NULL DEFAULT FALSE,

    /* Només els jugadors actius tenen posició al rànquing. */
    posicio             INTEGER,

    PRIMARY KEY (edicio_id, jugador_id),

    CHECK (NOT cohort_llegat OR darrera_temporada IS NULL)
);

CREATE INDEX barruf_valors_jugador_idx ON barruf_valors(jugador_id);

-- El detall auditable: per què s'ha mogut el BARRUF d'un jugador en un
-- campionat concret. És el que permet respondre "per què tinc 1247?".
CREATE TABLE barruf_variacions (
    campionat_id    UUID NOT NULL REFERENCES campionats(id) ON DELETE CASCADE,
    jugador_id      UUID NOT NULL REFERENCES jugadors(id) ON DELETE CASCADE,

    barruf_abans    NUMERIC(10,4) NOT NULL,
    partides        INTEGER NOT NULL,
    victories       NUMERIC(6,1) NOT NULL,
    esperanca       NUMERIC(10,6) NOT NULL,
    factor_k        INTEGER NOT NULL,
    variacio        NUMERIC(10,4) NOT NULL,
    barruf_despres  NUMERIC(10,4) NOT NULL,

    PRIMARY KEY (campionat_id, jugador_id)
);

CREATE INDEX barruf_variacions_jugador_idx ON barruf_variacions(jugador_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- Lectura pública del que es publica. Escriptura només per als gestors. Les
-- dades de contacte no surten mai per la via pública: es llegeixen per la
-- vista jugadors_publics, i la taula jugadors queda tancada.
-- -----------------------------------------------------------------------------

ALTER TABLE perfils            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jugadors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE jugador_alies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE campionats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscripcions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE partides           ENABLE ROW LEVEL SECURITY;
ALTER TABLE barruf_edicions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE barruf_valors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE barruf_variacions  ENABLE ROW LEVEL SECURITY;

-- Lectura pública
CREATE POLICY lectura_publica ON clubs             FOR SELECT USING (TRUE);
CREATE POLICY lectura_publica ON temporades        FOR SELECT USING (TRUE);
CREATE POLICY lectura_publica ON campionats        FOR SELECT USING (TRUE);
CREATE POLICY lectura_publica ON inscripcions      FOR SELECT USING (TRUE);
CREATE POLICY lectura_publica ON partides          FOR SELECT USING (TRUE);
CREATE POLICY lectura_publica ON barruf_edicions   FOR SELECT USING (TRUE);
CREATE POLICY lectura_publica ON barruf_valors     FOR SELECT USING (TRUE);
CREATE POLICY lectura_publica ON barruf_variacions FOR SELECT USING (TRUE);

-- Dades personals i econòmiques: només gestors.
CREATE POLICY lectura_gestors ON jugadors      FOR SELECT USING (es_gestor());
CREATE POLICY lectura_gestors ON jugador_alies FOR SELECT USING (es_gestor());
CREATE POLICY lectura_gestors ON quotes        FOR SELECT USING (es_gestor());
CREATE POLICY lectura_propia  ON perfils       FOR SELECT USING (id = auth.uid());

-- Escriptura: només gestors.
CREATE POLICY escriptura_gestors ON clubs             FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
CREATE POLICY escriptura_gestors ON temporades        FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
CREATE POLICY escriptura_gestors ON jugadors          FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
CREATE POLICY escriptura_gestors ON jugador_alies     FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
CREATE POLICY escriptura_gestors ON quotes            FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
CREATE POLICY escriptura_gestors ON campionats        FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
CREATE POLICY escriptura_gestors ON inscripcions      FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
CREATE POLICY escriptura_gestors ON partides          FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
CREATE POLICY escriptura_gestors ON barruf_edicions   FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
CREATE POLICY escriptura_gestors ON barruf_valors     FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());
CREATE POLICY escriptura_gestors ON barruf_variacions FOR ALL USING (es_gestor()) WITH CHECK (es_gestor());

-- Vista pública de jugadors: nom, número i club, sense dades de contacte.
-- Amb `security_invoker = false` s'executa amb els permisos del propietari, de
-- manera que exposa aquestes tres columnes sense obrir la taula `jugadors`.
CREATE VIEW jugadors_publics
WITH (security_invoker = false) AS
    SELECT j.id, j.numero, j.nom_complet, j.club_id, c.nom AS club_nom
    FROM jugadors j
    LEFT JOIN clubs c ON c.id = j.club_id
    WHERE j.fusionat_a IS NULL;

-- -----------------------------------------------------------------------------
-- Privilegis
-- -----------------------------------------------------------------------------
-- Dues capes independents, i totes dues han de deixar passar l'operació:
-- els privilegis diuen a quines TAULES pot accedir cada rol, i l'RLS diu a
-- quines FILES. Es declaren aquí explícitament per no dependre dels privilegis
-- per defecte de Supabase: si un dia canviessin, aquest esquema continuaria
-- sent correcte.
-- -----------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Visitants no identificats: només lectura, i només del que es publica.
-- Fixeu-vos que `jugadors`, `jugador_alies`, `quotes` i `perfils` no hi surten:
-- les dades de contacte i les econòmiques no són accessibles ni tan sols en
-- lectura, amb política o sense.
GRANT SELECT ON
    clubs, temporades, campionats, inscripcions, partides,
    barruf_edicions, barruf_valors, barruf_variacions,
    jugadors_publics
TO anon, authenticated;

-- Gestors identificats. Qui tingui un compte però no sigui a `perfils` no
-- passarà l'RLS, de manera que aquests privilegis no li serveixen de res.
GRANT SELECT, INSERT, UPDATE, DELETE ON
    clubs, temporades, jugadors, jugador_alies, quotes,
    campionats, inscripcions, partides,
    barruf_edicions, barruf_valors, barruf_variacions
TO authenticated;

GRANT SELECT ON perfils TO authenticated;
GRANT USAGE ON SEQUENCE numero_jugador_seq TO authenticated;

-- -----------------------------------------------------------------------------
-- Manteniment de modificat_el
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION toca_modificat_el()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.modificat_el = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER toca_modificat_el BEFORE UPDATE ON clubs
    FOR EACH ROW EXECUTE FUNCTION toca_modificat_el();
CREATE TRIGGER toca_modificat_el BEFORE UPDATE ON jugadors
    FOR EACH ROW EXECUTE FUNCTION toca_modificat_el();
CREATE TRIGGER toca_modificat_el BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION toca_modificat_el();
CREATE TRIGGER toca_modificat_el BEFORE UPDATE ON campionats
    FOR EACH ROW EXECUTE FUNCTION toca_modificat_el();
