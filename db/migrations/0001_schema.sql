-- GameProbe schema.
--
-- Two kinds of data are kept apart on purpose:
--   * evidence_sources / evidence_claims: "a source on the internet reported this"
--   * test_sessions / test_observations:  "a person tested this exact environment"
-- They are never merged into one compatibility row.
--
-- NULL always means "unknown". Nothing in this schema derives or guesses a missing
-- game version, Android version, device or controller variant.

create table games (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (length(name) between 1 and 120),
  -- Alternative names people search for, e.g. 'WuWa'.
  aliases     text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- A concrete game version string as shown by the game. Only exact strings are
-- stored; words like "latest" are rejected by the check.
create table game_builds (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  version     text not null check (version ~ '^[0-9]+(\.[0-9]+){0,3}(-[0-9A-Za-z]+)?$'),
  created_at  timestamptz not null default now(),
  unique (game_id, version)
);

-- A product line as people name it ("8BitDo Ultimate 2").
create table controller_families (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  manufacturer  text not null check (length(manufacturer) between 1 and 80),
  name          text not null check (length(name) between 1 and 120),
  created_at    timestamptz not null default now()
);

-- An exact product ("8BitDo Ultimate 2 Wireless Controller"). A report is only linked
-- to a variant when the exact product is known.
create table controller_variants (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references controller_families(id) on delete cascade,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (length(name) between 1 and 160),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- External evidence: the private Evidence Inbox and reviewed claims.
-- ---------------------------------------------------------------------------

create table evidence_sources (
  id                     uuid primary key default gen_random_uuid(),
  url                    text not null check (url ~ '^https?://' and length(url) <= 2048),
  -- Normalized URL used to catch the same page being added twice.
  url_key                text not null unique,
  source_type            text not null check (source_type in
                           ('reddit', 'youtube', 'forum', 'discord', 'official', 'article', 'other')),
  title                  text check (length(title) <= 300),
  -- Short private excerpt kept for review. Not shown publicly.
  excerpt                text check (length(excerpt) <= 2000),
  published_on           date,
  added_at               timestamptz not null default now(),

  review_status          text not null default 'new' check (review_status in
                           ('new', 'lead', 'needs_direct_test', 'published', 'duplicate', 'rejected')),
  -- NULL: not assessed. FALSE: a question or discussion, not a compatibility report.
  is_report              boolean,

  game_id                uuid references games(id),
  controller_family_id   uuid references controller_families(id),
  controller_variant_id  uuid references controller_variants(id),
  -- Exact wording used by the source, e.g. "8BitDo Ultimate".
  controller_as_written  text check (length(controller_as_written) <= 160),
  device_as_written      text check (length(device_as_written) <= 160),
  device_model_code      text check (length(device_model_code) <= 40),
  android_version        text check (android_version ~ '^[0-9]{1,2}(\.[0-9]{1,2})?$'),
  game_version           text check (game_version ~ '^[0-9]+(\.[0-9]+){0,3}(-[0-9A-Za-z]+)?$'),
  connection_type        text check (connection_type in ('bluetooth', 'usb', 'dongle')),
  controller_mode        text check (length(controller_mode) <= 60),
  claim_summary          text check (length(claim_summary) <= 280),
  review_notes           text check (length(review_notes) <= 4000),
  duplicate_of_id        uuid references evidence_sources(id),
  reviewed_at            timestamptz,
  is_demo                boolean not null default false,

  check (duplicate_of_id is null or duplicate_of_id <> id),
  check ((review_status = 'duplicate') = (duplicate_of_id is not null)),
  check (review_status not in ('published', 'needs_direct_test') or is_report is true)
);

-- One reviewed statement about one control, extracted by a human from one source.
create table evidence_claims (
  id                     uuid primary key default gen_random_uuid(),
  source_id              uuid not null references evidence_sources(id) on delete cascade,
  game_id                uuid not null references games(id),
  controller_family_id   uuid not null references controller_families(id),
  controller_variant_id  uuid references controller_variants(id),
  controller_as_written  text,
  game_version           text,
  android_version        text,
  device_as_written      text,
  device_model_code      text,
  connection_type        text check (connection_type in ('bluetooth', 'usb', 'dongle')),
  controller_mode        text,
  control                text not null check (control in
                           ('menu', 'movement', 'camera', 'face_buttons', 'shoulders', 'triggers', 'dpad', 'vibration')),
  result                 text not null check (result in ('works', 'broken')),
  statement              text not null check (length(statement) between 1 and 280),
  -- 'published': limited external claim shown under External reports.
  -- 'needs_direct_test': shown only as a verification request.
  visibility             text not null check (visibility in ('published', 'needs_direct_test')),
  reported_on            date,
  created_at             timestamptz not null default now(),
  is_demo                boolean not null default false,
  unique (source_id, control)
);

-- ---------------------------------------------------------------------------
-- Direct tests submitted through the GameProbe form.
-- ---------------------------------------------------------------------------

create table test_sessions (
  id                     uuid primary key default gen_random_uuid(),
  status                 text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  method                 text not null default 'web_form' check (method in ('web_form')),

  game_id                uuid not null references games(id),
  game_build_id          uuid references game_builds(id),
  controller_family_id   uuid references controller_families(id),
  controller_variant_id  uuid references controller_variants(id),
  -- Free-text controller name when it is not in the catalog.
  controller_as_entered  text check (length(controller_as_entered) <= 160),
  device_as_entered      text check (length(device_as_entered) <= 160),
  device_model_code      text check (length(device_model_code) <= 40),
  android_version        text check (android_version ~ '^[0-9]{1,2}(\.[0-9]{1,2})?$'),
  connection_type        text check (connection_type in ('bluetooth', 'usb', 'dongle')),
  controller_mode        text check (length(controller_mode) <= 60),
  tested_on              date not null,
  notes                  text check (length(notes) <= 2000),

  -- Keyed hash of the submitter's network address and day. Used only for rate limiting.
  submitter_key          text,
  submitted_at           timestamptz not null default now(),
  reviewed_at            timestamptz,
  moderation_note        text check (length(moderation_note) <= 1000),
  is_demo                boolean not null default false,

  check (controller_family_id is not null or controller_as_entered is not null),
  check (controller_variant_id is null or controller_family_id is not null)
);

create table test_observations (
  session_id  uuid not null references test_sessions(id) on delete cascade,
  control     text not null check (control in
                ('menu', 'movement', 'camera', 'face_buttons', 'shoulders', 'triggers', 'dpad', 'vibration')),
  -- "Not tested" is represented by the absence of a row.
  result      text not null check (result in ('works', 'broken')),
  primary key (session_id, control)
);

create table admin_login_failures (
  id          bigint generated always as identity primary key,
  client_key  text not null,
  failed_at   timestamptz not null default now()
);

create index test_sessions_game_status_idx on test_sessions (game_id, status);
create index test_sessions_submitter_idx on test_sessions (submitter_key, submitted_at);
create index evidence_claims_game_idx on evidence_claims (game_id, controller_family_id);
create index evidence_sources_status_idx on evidence_sources (review_status);
create index admin_login_failures_idx on admin_login_failures (client_key, failed_at);

-- ---------------------------------------------------------------------------
-- Access control.
--
-- The web app talks to Postgres from the server only, as the table owner. On Supabase
-- the anon and authenticated roles (used by the public REST API) get no access at all:
-- RLS is enabled with no policies, and table privileges are revoked.
-- ---------------------------------------------------------------------------

alter table games enable row level security;
alter table game_builds enable row level security;
alter table controller_families enable row level security;
alter table controller_variants enable row level security;
alter table evidence_sources enable row level security;
alter table evidence_claims enable row level security;
alter table test_sessions enable row level security;
alter table test_observations enable row level security;
alter table admin_login_failures enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
    end if;
  end loop;
end $$;
