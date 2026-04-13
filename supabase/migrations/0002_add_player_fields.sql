-- Add personal fields to players
ALTER TABLE jugadors
  ADD COLUMN telefon TEXT,
  ADD COLUMN data_naixement DATE,
  ADD COLUMN barruf INTEGER DEFAULT 1000;
