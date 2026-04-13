-- Create tables for Scrabble management app

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clubs table
CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    poblacio TEXT
);

-- Players table
CREATE TABLE jugadors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    cognoms TEXT NOT NULL,
    club_id UUID REFERENCES clubs(id),
    email TEXT UNIQUE,
    es_soci BOOLEAN DEFAULT FALSE,
    data_alta DATE DEFAULT CURRENT_DATE
);

-- Seasons table
CREATE TABLE temporades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    data_inici DATE NOT NULL,
    data_fi DATE NOT NULL
);

-- Championships table
CREATE TABLE campionats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    temporada_id UUID NOT NULL REFERENCES temporades(id),
    nom TEXT NOT NULL,
    data DATE NOT NULL,
    tipus_campionat TEXT NOT NULL,
    desempat TEXT[]
);

-- Matches table
CREATE TABLE partides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campionat_id UUID NOT NULL REFERENCES campionats(id),
    ronda INTEGER NOT NULL,
    jugador_1_id UUID NOT NULL REFERENCES jugadors(id),
    jugador_2_id UUID NOT NULL REFERENCES jugadors(id),
    punts_1 INTEGER NOT NULL,
    punts_2 INTEGER NOT NULL,
    scrabbles_1 INTEGER DEFAULT 0,
    scrabbles_2 INTEGER DEFAULT 0,
    mot_1 TEXT,
    mot_2 TEXT,
    punts_mot_1 INTEGER,
    punts_mot_2 INTEGER,
    especial_1 TEXT,
    especial_2 TEXT,
    punts_especial_1 INTEGER,
    punts_especial_2 INTEGER
);

-- Membership fees table
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jugador_id UUID NOT NULL REFERENCES jugadors(id),
    any INTEGER NOT NULL,
    import DECIMAL(10,2) NOT NULL,
    pagat_status BOOLEAN DEFAULT FALSE,
    data_pagament DATE
);