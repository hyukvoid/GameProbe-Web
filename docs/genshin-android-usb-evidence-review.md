# Genshin Impact on Android — reviewed evidence review sheet

**Status: prepared for review only. Nothing in this file has been executed or inserted. No
database was contacted while preparing it (no `.env` / `.env.local` exists in this checkout;
only `.env.example`). Supabase production is untouched.**

Question under examination (not answered here):

> On Android, does Genshin Impact accept a controller over USB, or is controller support
> Bluetooth-only?

This sheet carries over the completed manual review pass of 2026-09-27: **6 reviewed
sources, 12 reviewed claims**. The earlier broad research pass (51 candidate URLs) is not
repeated here; only the already-reviewed pages appear.

## Deduplication and exclusions

Deliberately absent:

- Yahoo syndication of the Android Police article (same text, would double-count).
- Reddit / Facebook / IGN (robots-blocked, body never read).
- JS-shell-only pages (HoYoverse forum, HoYoLAB, Kuro pages where the body never rendered).
- The wrong-game HoYoverse article found in the earlier pass.

Every field below is what the page states. A field the page does not state stays empty
(unknown). No field is inferred.

## 1. Sources (6)

| # | Canonical URL | Type (proposed `source_type`) | Date as stated | Game | Platform scope | Controller family named | Exact variant named | Android version stated | Transport stated | Game version stated |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | https://support.hoyoverse.com/hc/en-us/articles/50333944370969-What-controllers-are-officially-supported | official (`official`) | updated 2025-09-17 | Genshin Impact | page covers PC / iOS / Android; only the **"Android (via Bluetooth)"** heading used | DualSense; DUALSHOCK 4; Xbox Wireless Controller; Xbox Elite Wireless Controller Series 2 | — | 12.0 / 10.0 / 9.0 / 9.0 (per controller) | Bluetooth | — |
| S2 | https://www.androidpolice.com/genshin-impact-finally-adds-controller-support-to-android | press (`article`) | published 2025-03-27 | Genshin Impact | Android hands-on | — | — | — | **Bluetooth and USB** | — |
| S3 | https://www.tomsguide.com/phones/android-phones/genshin-impact-on-android-finally-adds-controller-support-4-years-after-ios | press (`article`) | published 2025-03-13 | Genshin Impact | Android (pre-release report from the miHoYo Developer Discussion) | — | — | — | Bluetooth (USB-C-only pads called out as possibly unsupported) | 5.5 |
| S4 | https://game8.co/games/Genshin-Impact/archives/297549 | wiki (`article`, reviewer may pick `other`) | — | Genshin Impact | Android table used; the page's connection setup section is **PC-only** and was not used | DualSense; DUALSHOCK (page wording); Xbox Wireless Controller ("Bluetooth Version" wording); Xbox Elite Series 2 | "Bluetooth Version" wording only (not a catalog product) | 12.0 / 10.0 / 9.0 / 9.0 (per controller) | — | — |
| S5 | https://phandroid.com/2025/03/28/genshin-impact-finally-adds-native-controller-support-on-android | press (`article`) | published 2025-03-28 | Genshin Impact | Android | — | — | — | — (its Bluetooth/wired sentence describes what Android supports, not this game) | — |
| S6 | https://www.8bitdo.com/ultimate-2.4g-wireless-controller-genshin | vendor (`other`) | — | Genshin Impact | Android | "8BitDo Ultimate 2.4G Wireless Controller" (as written; catalog family needs a reviewer decision) | Genshin-licensed edition, named as written | 9.0 (as this controller's supported floor) | — | — |

Unknowns that stay unknown: device model, input/controller mode, dongle use, exact game
build, and every transport not listed above.

## 2. Claims (12)

Statements are quoted as reviewed; each is ≤ 280 characters (longest 274), so it fits both
`evidence_claims.statement` and `evidence_sources.claim_summary` unchanged.

| # | Source | Subject | Transport | Controller (as written) | Android floor | Game version | Reviewed statement |
|---|---|---|---|---|---|---|---|
| C1 | S1 | official support | Bluetooth | DualSense Wireless Controller | 12.0 | — | Listed under "Android (via Bluetooth)" as supported, Android 12.0+. |
| C2 | S1 | official support | Bluetooth | DUALSHOCK 4 Wireless Controller | 10.0 | — | Listed under "Android (via Bluetooth)" as supported, Android 10.0+. |
| C3 | S1 | official support | Bluetooth | Xbox Wireless Controller | 9.0 | — | Listed under "Android (via Bluetooth)" as supported, Android 9.0+. |
| C4 | S1 | official support | Bluetooth | Xbox Elite Wireless Controller Series 2 | 9.0 | — | Listed under "Android (via Bluetooth)" as supported, Android 9.0+. |
| C5 | S2 | support over transports | **Bluetooth and USB** | — | — | — | "Bluetooth and USB connections are supported, so whether you want to play wirelessly or corded, the choice is yours." Not on by default; must be toggled per connection; touchscreen stops working while a controller is connected. |
| C6 | S3 | support is Bluetooth-only | Bluetooth | — | — | 5.5 | Will support Bluetooth controllers after Version 5.5; all added controllers stated to require Bluetooth; USB-C-only pads "may not be officially supported when the update launches". |
| C7 | S4 | Android support list | — | DualSense Wireless Controller | 12.0 | — | Listed under "Supported Controllers - Android", Android 12.0 and above. |
| C8 | S4 | Android support list | — | DUALSHOCK Wireless Controller | 10.0 | — | Listed under "Supported Controllers - Android", Android 10.0 and above. |
| C9 | S4 | Android support list | — | Xbox Wireless Controller ("Bluetooth Version") | 9.0 | — | Listed under "Supported Controllers - Android", Android 9.0 and above. |
| C10 | S4 | Android support list | — | Xbox Elite Wireless Controller Series 2 | 9.0 | — | Listed under "Supported Controllers - Android", Android 9.0 and above. |
| C11 | S5 | support live, off by default | — | — | — | — | "Genshin Impact controller support is finally live on Android." Not enabled by default, toggled in settings each launch, no auto-detection. |
| C12 | S6 | vendor says not supported | — | 8BitDo Ultimate 2.4G Wireless Controller | 9.0 (controller floor) | — | Footnote: "The Android version of Genshin Impact does not support external controller." Page also states Android 9.0+ and official licensing. |

## 3. The contradiction, as recorded (no winner declared)

- Official (S1): Android → **Bluetooth** only, four controllers, per-controller Android floors.
- Secondary (S2): Android → **Bluetooth and USB**. (S3 says Bluetooth required; S5 and S4
  state no transport for Android; S6's footnote says Android Genshin does not support an
  external controller for that pad.)
- Direct Android USB tests in GameProbe: **0**. This repository seeds no Genshin test, and
  no test was created for this sheet. Production was not queried (no connection attempted),
  so production is not claimed to be empty — only that GameProbe has published no direct
  USB test for this question.

Nothing here writes "USB works" or "USB does not work". No confidence or reliability score
exists anywhere in this proposal.

## 4. What the existing schema already supports

Confirmed by reading `db/migrations/*.sql` and the code paths for the Evidence Inbox,
admin moderation, public game pages and `/submit`:

- `evidence_sources`: URL + duplicate key, source type, published date, excerpt (private),
  review status workflow (`new → lead | needs_direct_test | published | duplicate |
  rejected`), `is_report`, game, controller family/variant, wording-as-written, device
  wording, Android version, game version, single transport, controller mode, public
  `claim_summary` (≤280), review notes (≤4000). Nulls mean unknown. ✔
- `evidence_claims`: source → game, controller family/variant, Android version, game
  version, transport, controller mode, control, works/broken, statement, visibility
  `published | needs_direct_test`, `reported_on`, one row per `(source_id, control)`. ✔
- `test_sessions` / `test_observations`: exact controller (catalog or free text), device,
  Android version, transport, controller mode, game build, tested-on date, notes, and 8
  controls with `Works / Broken / Not tested` (absent row = not tested). Moderation gates
  publication. ✔
- Public UX already has: per-game controllers table, per-control states including
  `reported_works`, `reported_conflicting`, a **"Needs verification"** list driven by
  `visibility = 'needs_direct_test'`, a direct-tests list (with an explicit empty state),
  and an "External reports" list with per-claim statements, transport, dates and an
  unknown marker for missing fields. ✔
- Aggregation already derives a conflict plus the **condition dimension that explains it**
  (`connection`, `gameVersion`, `variant`, `androidVersion`) — i.e. it can already say
  "reports differ; one says Bluetooth, the other USB cable". ✔

So the transport, controller family, exact variant, controller/input mode, game version,
Android version and platform scope dimensions are all *columns that exist*; the `/submit`
flow captures every dimension in the brief except detection (see G4).

## 5. Confirmed schema gaps (only these)

Written as found, before `db/migrations/0004_connection_claims.sql`. G1–G4 are addressed
in §6; G5 deliberately is not.

**G1 — No claim subject for controller support / transport. Blocking.**
`evidence_claims.control` accepts only `menu, movement, camera, face_buttons, shoulders,
triggers, dpad, vibration` (`0001_schema.sql` L107-108), and `result` only
`works|broken`. All 12 reviewed statements are about *whether the game accepts a controller
and over which transport*, not about one input control. Recording them would require
inventing a control outcome, which this experiment forbids. Publishing additionally
requires ≥1 control result (`src/lib/validation.ts` L326), so **0 of 6 sources can be
published today** and none of the 12 claims can become an `evidence_claims` row.

**G2 — One source cannot state the same subject for two controllers or two transports.
Blocking.**
`unique (source_id, control)` (`0001_schema.sql` L117). S1 states it for four controllers,
S4 for four, S2 for two transports. Even after G1 is fixed, at most one of those rows could
exist.

**G3 — A claim must name a controller family. Blocking for 3 of 6 sources.**
`evidence_claims.controller_family_id uuid not null` (L98) plus publish validation
"Choose at least the controller family" (`validation.ts` L325). S2, S3 and S5 name no
controller. Separately, the catalog (`0002_catalog.sql`) has no **Xbox Elite Wireless
Controller Series 2** family, which blocks C4 and C10; S6's "8BitDo Ultimate 2.4G" needs a
reviewer decision against the existing 8BitDo families (recorded as written either way).
*(Both catalog readings were re-checked against the catalog's own convention and corrected
in §6: the Elite Series 2 already exists as a variant of `xbox-wireless-controller`, and
8BitDo Ultimate 2.4G already exists as a variant of `8bitdo-ultimate`; no new families were
created.)*

**G4 — `/submit` cannot record detection. Non-blocking for the contradiction.**
Everything else in the brief is capturable (family, exact model, USB vs Bluetooth, Android
version, game version, movement, camera, face buttons, shoulders, triggers, D-pad, menu,
vibration, unknowns → null/absent). "Whether the game detected the controller" has no
field; it can only be written into free-text `notes`.

**G5 — No platform column anywhere. Not blocking for this seed.**
The product is Android-only by definition (README L3), every one of the six sources is
Android-scoped, and `android_version` is present. The residual risk — a statement taken
from a PC/iOS section of a multi-platform page looking like Android evidence — is handled
here by recording the platform scope in this sheet and by the review notes; S4's PC-only
connection section was explicitly excluded. **No migration proposed for G5.**

Also checked and fine: statement lengths (all ≤280), URL uniqueness, exact-version
enforcement (`latest` rejected), duplicate handling, `is_report` gating, RLS on all tables.

## 6. Minimal changes — applied in `0004_connection_claims.sql` and the app code

One migration plus type/validation/UI plumbing, reusing the existing evidence and
needs-verification UI. No new dashboard, no analytics, no scoring.

- `db/migrations/0004_connection_claims.sql`
  1. extend `evidence_claims.control` check with `'controller_support'` (label: "Controller
     support") — a claim subject meaning "the source states the game accepts a controller",
     with `connection_type` carrying Bluetooth/USB when the source states a transport;
  2. replace `unique (source_id, control)` with
     `unique nulls not distinct (source_id, control, controller_family_id,
     controller_variant_id, connection_type, controller_mode, game_version,
     android_version)` (PostgreSQL 15+) so one source can state it for several
     controllers, transports, Android versions, game versions or controller modes, while
     an exact repeat is refused. Statement wording, visibility, reported_on and is_demo
     are not condition dimensions and are deliberately not in the index;
  3. `alter table evidence_claims alter column controller_family_id drop not null` — a
     source that names no controller is stored with a null family (the composite FK from
     `0003_integrity.sql` is MATCH SIMPLE and still holds when set);
  4. catalog: **no change needed.** The catalog already lists `Xbox Elite Wireless
     Controller Series 2 (Model 1797)` as a *variant* under the `xbox-wireless-controller`
     family, which is this catalog's convention for named revisions (see also DualSense
     Edge, DualShock 4 CUH-ZCT1/ZCT2, Xbox models 1708/1914). C4 and C10 therefore record
     family `xbox-wireless-controller`, `controller_as_written = "Xbox Elite Wireless
     Controller Series 2"` and a null variant, because the source states no model number.
     No new family was created for a named revision.
  5. `test_sessions.controller_detected boolean` — `true` = the game detected/accepted the
     controller, `false` = it did not, `NULL` = could not determine or not recorded. Never
     derived from the observations.
- `src/lib/domain.ts` — `EVIDENCE_CONTROLS = [...CONTROLS, 'controller_support']` and its
  labels; `CONTROLS` (used by `/submit` and `test_observations`) stays 8 values, so the new
  subject is never offered as a button to press.
- `src/lib/validation.ts` — `parseEvidenceReview` collects results over `EVIDENCE_CONTROLS`;
  publishing with no controller family is allowed (the family is only required when the
  reviewer picks one); `parseTestSubmission` accepts the detection answer.
- `src/lib/data/admin.ts` — claim insert types widen to the new subject vocabulary.
- `src/app/admin/evidence/[id]/review-form.tsx` — one extra row in "Stated results", plus a
  hint that the controller may be left empty.
- `src/lib/data/public.ts` — `listClaims` left-joins `controller_families` and returns a
  nullable `familySlug`/`familyName`; reports are grouped per source *and* controller, each
  claim keeps its own transport; family-less claims stay out of the controllers table
  (`listEvidenceItems` skips external items with no family) but appear in External reports.
- `src/components/evidence.tsx` (+ `src/lib/aggregate.ts`, `src/components/issues.tsx`) —
  widen the claim-side control type, render "Controller not specified" when there is no
  family link, label the new subject, show the transport per claim and the detection fact
  on direct tests.
- `src/app/submit/submit-form.tsx` — the detection radio group (Yes / No / Not sure or not
  tested). A submission with no control result is accepted only when the tester answered
  "No", so "not detected, nothing to test" is still submittable.
- Tests: `tests/integrity.test.ts` (DB-level: new subject and all 8 existing controls
  accepted; exact duplicate scope refused; same source with a different transport, Android
  version, game version, controller mode or controller accepted; family-less claim accepted;
  `controller_detected` true/false/null accepted and independent of the observations),
  `tests/evidence.test.ts` (family-less source published, visible under External reports,
  absent from the controllers table and from direct tests; support claim summarised and
  still needing verification), `tests/submissions.test.ts` (detection stored as answered,
  approved record shows it) and `tests/validation.test.ts` (publishing still requires a
  game, a result and a written claim).

**Known limitation for the seeding step:** the review form still has one controller field
and one connection field, and re-reviewing a source replaces its claims. A source that
covers several controllers (S1, S4) or several transports (S2) therefore cannot be
produced through the form alone — the schema accepts those rows (proved by the DB tests),
but they must be written as part of the manual, reviewed insert. No code was added for that
here, and nothing was inserted.

Deliberately **not** done: platform column, funnel/analytics counters, confidence or
reliability scores, auto-publishing, a contradiction engine, any change to the Android app.

## 7. How the public page would then read (no winner declared)

- Controllers table: official rows as `reported works` (Bluetooth) for the four/five
  families, with `reported conflicting` wherever a second transport disagrees.
- Needs verification: the USB-side claim flagged `needs_direct_test` by a reviewer — the
  existing verification-request list, showing the open USB question with its source.
- External reports: S1 (Bluetooth) next to S2 (Bluetooth **and** USB) next to S3
  (Bluetooth required), each with its date, transport and statement, unknowns marked.
- Direct tests: empty state — "no direct GameProbe test of Genshin Impact on Android over
  USB exists yet".

Which of these is `published` versus `needs_direct_test` is an editorial decision for the
reviewer, not something this sheet decides.
