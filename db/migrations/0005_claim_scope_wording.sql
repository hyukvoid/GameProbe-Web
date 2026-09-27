-- One missing uniqueness dimension, found by a production seed attempt that rolled back.
--
-- A single reviewed source may name two different controllers that normalize to the same
-- catalog link because the source states no model number:
--
--   "Xbox Wireless Controller"          -> family xbox-wireless-controller, variant NULL
--   "Xbox Elite Wireless Controller Series 2" -> family xbox-wireless-controller, variant NULL
--
-- Scope without `controller_as_written` therefore refuses the second claim as a duplicate
-- of the first. The wording column is what distinguishes them, so it joins the scope; it is
-- required for exactly this case, where catalog normalization cannot separate two
-- different controllers named by the same source. Everything else about the scope is
-- unchanged, and NULLS NOT DISTINCT stays, so an exact repeat is still refused.

alter table evidence_claims drop constraint evidence_claims_scope_key;

alter table evidence_claims
  add constraint evidence_claims_scope_key
  unique nulls not distinct (
    source_id, control, controller_family_id, controller_variant_id, controller_as_written,
    connection_type, controller_mode, game_version, android_version
  );
