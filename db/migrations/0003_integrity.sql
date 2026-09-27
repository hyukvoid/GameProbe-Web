-- Database-level integrity for relationships the application already maintains.
--
-- A controller model must belong to the family stored next to it, and a game build must
-- belong to the game stored next to it. Composite foreign keys enforce the pairing, so a
-- row can't claim "DualSense" with an 8BitDo model, or a Genshin Impact build on a
-- Wuthering Waves test.
--
-- The foreign keys use MATCH SIMPLE: they are checked whenever the model (or build) is
-- set. A family without a model stays valid. A model without a family is refused by a
-- CHECK (test_sessions already has one; evidence_sources gets one here; evidence_claims
-- requires a family).

-- 1. Valid (model, family) pairs.
alter table controller_variants
  add constraint controller_variants_id_family_key unique (id, family_id);

-- 2. Evidence sources.
alter table evidence_sources
  add constraint evidence_sources_variant_needs_family
    check (controller_variant_id is null or controller_family_id is not null),
  add constraint evidence_sources_variant_family_fkey
    foreign key (controller_variant_id, controller_family_id)
    references controller_variants (id, family_id);

-- 3. Evidence claims.
alter table evidence_claims
  add constraint evidence_claims_variant_family_fkey
    foreign key (controller_variant_id, controller_family_id)
    references controller_variants (id, family_id);

-- 4. Direct tests.
alter table test_sessions
  add constraint test_sessions_variant_family_fkey
    foreign key (controller_variant_id, controller_family_id)
    references controller_variants (id, family_id);

-- 5. Valid (build, game) pairs.
alter table game_builds
  add constraint game_builds_id_game_key unique (id, game_id);

-- 6. A test's build must be a build of the tested game.
alter table test_sessions
  add constraint test_sessions_build_game_fkey
    foreign key (game_build_id, game_id)
    references game_builds (id, game_id);

-- 7-8. Claims use the same exact formats as sources and builds.
alter table evidence_claims
  add constraint evidence_claims_game_version_format
    check (game_version ~ '^[0-9]+(\.[0-9]+){0,3}(-[0-9A-Za-z]+)?$'),
  add constraint evidence_claims_android_version_format
    check (android_version ~ '^[0-9]{1,2}(\.[0-9]{1,2})?$');
