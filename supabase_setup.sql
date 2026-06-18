-- ============================================================
-- SCRIPT DE CRÉATION COMPLÈTE — Cathédrale Saint André
-- Exécuter dans Supabase → SQL Editor
-- Toutes les tables utilisées par l'app mobile ET le back office
-- ============================================================

-- ── 1. PROFILES (extension de auth.users) ──────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom         TEXT,
  prenoms     TEXT DEFAULT '',
  telephone   TEXT,
  is_admin    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. ANNONCES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annonces (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre       TEXT NOT NULL,
  contenu     TEXT,
  categorie   TEXT DEFAULT 'activites',
  est_urgent  BOOLEAN DEFAULT false,
  est_actif   BOOLEAN DEFAULT true,
  image_url   TEXT,
  date_debut  DATE,
  date_fin    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. ACTUALITÉS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actualites (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre        TEXT NOT NULL,
  article      TEXT,
  categorie    TEXT DEFAULT 'vie_paroisse',
  est_a_la_une BOOLEAN DEFAULT false,
  video_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actualite_photos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actualite_id  UUID REFERENCES actualites(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  ordre         INTEGER DEFAULT 0
);

-- ── 4. CAMPAGNES DE DONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS don_campagnes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre            TEXT NOT NULL,
  description      TEXT,
  type             TEXT DEFAULT 'categorie', -- 'construction' | 'libre' | 'categorie'
  objectif         INTEGER DEFAULT 0,
  montant_collecte INTEGER DEFAULT 0,
  est_actif        BOOLEAN DEFAULT true,
  ordre            INTEGER DEFAULT 0,
  image_url        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. DONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dons (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES profiles(id),
  campagne_id         UUID REFERENCES don_campagnes(id),
  campagne_titre      TEXT,
  montant             INTEGER NOT NULL,
  montant_libre       BOOLEAN DEFAULT false,
  frais_plateforme    INTEGER DEFAULT 200,
  frais_mobile_money  INTEGER DEFAULT 0,
  operateur_paiement  TEXT,
  message             TEXT,
  statut              TEXT DEFAULT 'en_attente',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. HORAIRES DE MESSE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS messe_horaires (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jour         TEXT,              -- 'Lundi', 'Mardi'… (pour l'affichage)
  jour_semaine INTEGER,           -- 1=Lundi … 7=Dimanche (pour la requête Flutter)
  heure        TEXT NOT NULL,     -- 'HH:MM'
  est_actif    BOOLEAN DEFAULT true
);

-- ── 7. DEMANDES DE MESSE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS messe_demandes (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES profiles(id),
  type_demandeur      TEXT DEFAULT 'pour_moi',
  nom_tiers           TEXT,
  type_messe          TEXT,
  date_messe          DATE,
  heure_messe         TEXT,
  intention           TEXT,
  montant             INTEGER DEFAULT 3000,
  frais_plateforme    INTEGER DEFAULT 200,
  frais_mobile_money  INTEGER DEFAULT 0,
  operateur_paiement  TEXT,
  statut              TEXT DEFAULT 'en_attente',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. TARIFS CASUELS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS casuel_tarifs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categorie  TEXT NOT NULL, -- 'initiation' | 'mariage' | 'enterrement'
  sous_type  TEXT NOT NULL,
  label      TEXT NOT NULL,
  montant    INTEGER NOT NULL,
  est_actif  BOOLEAN DEFAULT true
);

-- ── 9. DEMANDES CASUELS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS casuel_demandes (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES profiles(id),
  type_demandeur      TEXT DEFAULT 'pour_moi',
  nom_beneficiaire    TEXT,
  categorie           TEXT,
  sous_type           TEXT,
  label               TEXT,
  montant             INTEGER,
  frais_plateforme    INTEGER DEFAULT 200,
  frais_mobile_money  INTEGER DEFAULT 0,
  operateur_paiement  TEXT,
  statut              TEXT DEFAULT 'en_attente',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. DÉNIER DU CULTE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS denier_culte (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES profiles(id),
  annee               INTEGER NOT NULL,
  montant             INTEGER DEFAULT 0,
  statut              TEXT DEFAULT 'non_paye', -- 'non_paye' | 'partiel' | 'paye'
  date_paiement       TIMESTAMPTZ,
  operateur_paiement  TEXT,
  UNIQUE (user_id, annee)
);

-- ── 11. SAINT DU JOUR ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS saint_jour (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         TEXT NOT NULL,
  sous_titre  TEXT,
  date_fete   TEXT, -- format 'MM-DD'
  image_url   TEXT,
  biographie  TEXT,
  citation    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. TEXTE DU JOUR ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS texte_jour (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_lecture  DATE,
  titre         TEXT,
  reference     TEXT,
  contenu       TEXT,
  evangile      TEXT,
  reflexion     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. PODCASTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS podcast_series (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre       TEXT NOT NULL,
  description TEXT,
  categorie   TEXT,
  image_url   TEXT,
  est_actif   BOOLEAN DEFAULT true,
  ordre       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS podcast_episodes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  serie_id    UUID REFERENCES podcast_series(id) ON DELETE CASCADE,
  numero      INTEGER,
  titre       TEXT NOT NULL,
  description TEXT,
  format      TEXT DEFAULT 'audio', -- 'audio' | 'video'
  url_media   TEXT,
  duree       INTEGER DEFAULT 0,   -- secondes
  image_url   TEXT,
  est_gratuit BOOLEAN DEFAULT true,
  prix        INTEGER DEFAULT 0,
  est_actif   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS podcast_achats (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES profiles(id),
  episode_id         UUID REFERENCES podcast_episodes(id),
  montant            INTEGER,
  operateur_paiement TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── 14. CARROUSEL ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carrousel_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre       TEXT,
  description TEXT,
  image_url   TEXT NOT NULL,
  lien_url    TEXT,
  ordre       INTEGER DEFAULT 0,
  est_actif   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 15. CONFIGURATION GLOBALE ───────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  cle        TEXT PRIMARY KEY,
  valeur     TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DÉSACTIVER RLS SUR TOUTES LES TABLES (accès back office)
-- ============================================================
ALTER TABLE profiles         DISABLE ROW LEVEL SECURITY;
ALTER TABLE annonces         DISABLE ROW LEVEL SECURITY;
ALTER TABLE actualites       DISABLE ROW LEVEL SECURITY;
ALTER TABLE actualite_photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE don_campagnes    DISABLE ROW LEVEL SECURITY;
ALTER TABLE dons             DISABLE ROW LEVEL SECURITY;
ALTER TABLE messe_horaires   DISABLE ROW LEVEL SECURITY;
ALTER TABLE messe_demandes   DISABLE ROW LEVEL SECURITY;
ALTER TABLE casuel_tarifs    DISABLE ROW LEVEL SECURITY;
ALTER TABLE casuel_demandes  DISABLE ROW LEVEL SECURITY;
ALTER TABLE denier_culte     DISABLE ROW LEVEL SECURITY;
ALTER TABLE saint_jour       DISABLE ROW LEVEL SECURITY;
ALTER TABLE texte_jour       DISABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_series   DISABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_episodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_achats   DISABLE ROW LEVEL SECURITY;
ALTER TABLE carrousel_items  DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_config       DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- DONNÉES INITIALES
-- ============================================================

-- Campagnes de dons par défaut
INSERT INTO don_campagnes (titre, description, type, objectif, montant_collecte, est_actif, ordre) VALUES
  ('Construction de la Cathédrale', 'Participez à la construction de notre nouvelle cathédrale', 'construction', 50000000, 0, true, 1),
  ('Don libre pour l''Église', 'Soutenez librement la vie de la paroisse', 'libre', 0, 0, true, 2),
  ('Séminaire & Vocations', 'Soutenir les séminaristes du diocèse', 'categorie', 0, 0, true, 3),
  ('Secours Catholique', 'Aide aux familles démunies', 'categorie', 0, 0, true, 4)
ON CONFLICT DO NOTHING;

-- Tarifs casuels par défaut
INSERT INTO casuel_tarifs (categorie, sous_type, label, montant, est_actif) VALUES
  ('initiation', 'bapteme_bebe',    'Baptême bébé',      5000,  true),
  ('initiation', 'bapteme_adulte',  'Baptême adulte',     8000,  true),
  ('initiation', 'premiere_communion', 'Première communion', 5000, true),
  ('initiation', 'confirmation',    'Confirmation',       5000,  true),
  ('mariage',    'mariage_simple',  'Mariage simple',    25000, true),
  ('mariage',    'mariage_solennel','Mariage solennel',  50000, true),
  ('enterrement','enterrement_simple','Enterrement simple', 15000, true),
  ('enterrement','enterrement_solennel','Enterrement solennel', 30000, true)
ON CONFLICT DO NOTHING;

-- Horaires de messe par défaut
INSERT INTO messe_horaires (jour, jour_semaine, heure, est_actif) VALUES
  ('Dimanche',  7, '07:30', true),
  ('Dimanche',  7, '09:30', true),
  ('Dimanche',  7, '11:30', true),
  ('Samedi',    6, '18:30', true),
  ('Lundi',     1, '07:00', true),
  ('Mardi',     2, '07:00', true),
  ('Mercredi',  3, '07:00', true),
  ('Jeudi',     4, '07:00', true),
  ('Vendredi',  5, '07:00', true)
ON CONFLICT DO NOTHING;

-- Configuration globale
INSERT INTO app_config (cle, valeur) VALUES
  ('nom_paroisse',            'Cathédrale Saint André de Yopougon'),
  ('adresse',                 'Yopougon, Abidjan, Côte d''Ivoire'),
  ('telephone',               '+225 00 00 00 00'),
  ('email_contact',           'contact@sainandre-yopougon.ci'),
  ('montant_messe',           '3000'),
  ('frais_plateforme',        '200'),
  ('montant_denier_suggere',  '5000'),
  ('cgu',                     'Conditions Générales d''Utilisation à rédiger.'),
  ('cgv',                     'Conditions Générales de Vente à rédiger.'),
  ('politique_confidentialite', 'Politique de confidentialité à rédiger.'),
  ('mentions_legales',        'Mentions légales à rédiger.')
ON CONFLICT (cle) DO NOTHING;

-- ============================================================
-- TRIGGER : créer le profil automatiquement à l'inscription
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nom, telephone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'telephone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
