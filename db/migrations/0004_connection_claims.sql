-- Four minimal changes so the Genshin Impact on Android question can be stored as
-- reviewed evidence and as a direct test. Nothing else changes: no platform column, no
-- analytics, no scores, no reputation, no comments, no votes, no crawler, no extraction.
--
-- 1. A claim can be about controller support, not only about one input control.
--    Direct tests are unaffected: the eight physical controls are all a tester reports.
--
-- 2. Claim uniqueness is scoped to the full condition set. One source legitimately says
--    different things about different controllers, transports, Android versions, game
--    versions or controller modes, while an exact repeat must still be refused.
--    Statement wording, visibility, reported_on and is_demo are deliberately left out:
--    they are not conditions of a claim. Device wording is recorded once on the source
--    row (the review form has a single device field), so it is not part of the scope.
--
-- 3. A claim no longer requires a controller family. Android Police, Tom's Guide and
--    Phandroid state controller support for Genshin Impact on Android without naming any
--    controller; such a claim keeps a NULL family and is shown as "Controller not
--    specified". The composite foreign key from 0003_integrity.sql is MATCH SIMPLE, so
--    it still governs every row that does name a family and a model.
--
-- 4. A direct test records whether the game detected the controller, independently of
--    the per-control results: detection can be true while triggers are broken, or false
--    with no control tested at all.

-- 1. Evidence claim subject ------------------------------------------------------

alter table evidence_claims drop constraint evidence_claims_control_check;
alter table evidence_claims
  add constraint evidence_claims_control_check
  check (control in (
    'menu', 'movement', 'camera', 'face_buttons', 'shoulders', 'triggers', 'dpad', 'vibration',
    'controller_support'
  ));

-- 2. Condition-complete claim uniqueness -----------------------------------------

alter table evidence_claims drop constraint evidence_claims_source_id_control_key;
alter table evidence_claims
  add constraint evidence_claims_scope_key
  unique nulls not distinct (
    source_id, control, controller_family_id, controller_variant_id,
    connection_type, controller_mode, game_version, android_version
  );

-- 3. Claims without a named controller -------------------------------------------

alter table evidence_claims alter column controller_family_id drop not null;

-- 4. Detection, as reported by the tester ----------------------------------------
--    true  = the game detected or accepted the controller
--    false = it did not
--    NULL  = could not determine, or not recorded. Never derived from the observations.

alter table test_sessions add column controller_detected boolean;
