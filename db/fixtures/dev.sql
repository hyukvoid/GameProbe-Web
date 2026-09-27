-- DEVELOPMENT FIXTURES. NOT REAL REPORTS.
--
-- Invented records for exercising the UI and tests locally. Every row has is_demo = true,
-- all source URLs point at example.com, and the app hides them unless SHOW_DEMO_DATA=true.
-- Never load this file into a production database (scripts/load-fixtures.mjs refuses).

delete from evidence_sources where is_demo;
delete from test_sessions where is_demo;

insert into game_builds (game_id, version)
select g.id, v.version
from (values ('wuthering-waves', '2.8.1'), ('wuthering-waves', '2.8.0'), ('genshin-impact', '6.1.0')) as v(slug, version)
join games g on g.slug = v.slug
on conflict do nothing;

-- Direct tests ---------------------------------------------------------------------------

create temporary table fixture_tests (
  key text, status text, game text, version text, family text, variant text, controller_text text,
  device text, model text, android text, connection text, mode text, tested_on date, notes text,
  results text
) on commit drop;

insert into fixture_tests values
  ('ww-usb',   'approved', 'wuthering-waves', '2.8.1', '8bitdo-ultimate-2', '8bitdo-ultimate-2-wireless', null,
   'Galaxy S25', 'SM-S931B', '16', 'usb', 'XInput', '2026-09-20',
   'Development fixture. Triggers register over USB.',
   'menu=works,movement=works,camera=works,face_buttons=works,shoulders=works,triggers=works,dpad=works'),
  ('ww-bt',    'approved', 'wuthering-waves', '2.8.1', '8bitdo-ultimate-2', '8bitdo-ultimate-2-wireless', null,
   'Pixel 9', null, '16', 'bluetooth', null, '2026-09-24',
   'Development fixture. RT does nothing in combat over Bluetooth; LT works.',
   'menu=works,movement=works,camera=works,face_buttons=works,shoulders=works,triggers=broken'),
  ('ww-ds',    'approved', 'wuthering-waves', null, 'sony-dualsense', null, null,
   null, null, null, 'bluetooth', null, '2026-09-18',
   'Development fixture. Game version not recorded.',
   'menu=works,movement=works,camera=works,triggers=works,vibration=broken'),
  ('gi-ds',    'approved', 'genshin-impact', '6.1.0', 'sony-dualsense', 'dualsense-wireless-controller', null,
   'Galaxy Tab S9', 'SM-X710', '15', 'bluetooth', null, '2026-09-22',
   'Development fixture.',
   'menu=works,movement=works,camera=works,face_buttons=works,shoulders=works,triggers=works,dpad=works,vibration=works'),
  ('hsr-other','approved', 'honkai-star-rail', null, null, null, 'Generic Bluetooth gamepad',
   null, null, '14', 'bluetooth', null, '2026-09-10',
   'Development fixture. Controller not in the catalog.',
   'menu=broken,movement=works'),
  ('ww-pend',  'pending',  'wuthering-waves', '2.8.1', 'sony-dualsense', null, null,
   'Galaxy S24', null, '15', 'usb', null, '2026-09-26',
   'Development fixture awaiting review. Must not appear publicly.',
   'triggers=broken'),
  ('gi-rej',   'rejected', 'genshin-impact', null, 'xbox-wireless-controller', null, null,
   null, null, null, null, null, '2026-09-12',
   'Development fixture that was rejected. Must not appear publicly.',
   'menu=broken');

with inserted as (
  insert into test_sessions (
    status, game_id, game_build_id, controller_family_id, controller_variant_id, controller_as_entered,
    device_as_entered, device_model_code, android_version, connection_type, controller_mode, tested_on,
    notes, is_demo, reviewed_at
  )
  select t.status, g.id, b.id, f.id, v.id, t.controller_text, t.device, t.model, t.android, t.connection,
         t.mode, t.tested_on, t.notes, true, case when t.status <> 'pending' then now() end
  from fixture_tests t
  join games g on g.slug = t.game
  left join game_builds b on b.game_id = g.id and b.version = t.version
  left join controller_families f on f.slug = t.family
  left join controller_variants v on v.slug = t.variant
  returning id, notes
)
insert into test_observations (session_id, control, result)
select i.id, split_part(pair, '=', 1), split_part(pair, '=', 2)
from inserted i
join fixture_tests t on t.notes = i.notes
cross join lateral unnest(string_to_array(t.results, ',')) as pair;

-- Evidence inbox -------------------------------------------------------------------------

insert into evidence_sources (
  url, url_key, source_type, title, published_on, review_status, is_report, game_id,
  controller_family_id, controller_variant_id, controller_as_written, device_as_written, android_version,
  game_version, connection_type, claim_summary, review_notes, reviewed_at, is_demo, excerpt
)
select v.url, v.url_key, v.source_type, v.title, v.published_on::date, v.review_status, v.is_report, g.id,
       f.id, null, v.as_written, v.device, v.android, v.version, v.connection, v.summary, v.notes,
       case when v.review_status <> 'new' then now() end, true, v.excerpt
from (values
  ('https://example.com/gameprobe-fixture/ww-rt', 'example.com/gameprobe-fixture/ww-rt', 'forum',
   'Fixture: RT not working in Wuthering Waves', '2026-09-15', 'published', true, 'wuthering-waves',
   '8bitdo-ultimate-2', '8BitDo Ultimate 2', null, null, null, 'bluetooth',
   'RT does not respond in Wuthering Waves over Bluetooth; other buttons work.',
   'Development fixture.', 'Fixture excerpt.'),
  ('https://example.com/gameprobe-fixture/gi-ds', 'example.com/gameprobe-fixture/gi-ds', 'reddit',
   'Fixture: DualSense fine in Genshin', '2026-08-30', 'published', true, 'genshin-impact',
   'sony-dualsense', 'PS5 controller', 'Galaxy S23', '14', null, null,
   'All buttons and vibration work with a PS5 controller.',
   'Development fixture.', null),
  ('https://example.com/gameprobe-fixture/hsr-ab', 'example.com/gameprobe-fixture/hsr-ab', 'youtube',
   'Fixture: A/B swapped in Star Rail', '2026-09-05', 'needs_direct_test', true, 'honkai-star-rail',
   '8bitdo-ultimate-2c', '8BitDo Ultimate 2C', null, null, null, null,
   'A and B appear swapped in menus. Source does not say which mode the controller was in.',
   'Development fixture. Needs a direct test with the mode recorded.', null),
  ('https://example.com/gameprobe-fixture/question', 'example.com/gameprobe-fixture/question', 'reddit',
   'Fixture: Does DualSense work in Genshin?', '2026-09-01', 'rejected', false, 'genshin-impact',
   null, 'DualSense', null, null, null, null, null,
   'Development fixture. Question, not a report.', null),
  ('https://example.com/gameprobe-fixture/new', 'example.com/gameprobe-fixture/new', 'forum',
   'Fixture: unreviewed thread', null, 'new', null, null, null, null, null, null, null, null, null,
   null, 'Unreviewed fixture excerpt.')
) as v(url, url_key, source_type, title, published_on, review_status, is_report, game_slug, family_slug,
       as_written, device, android, version, connection, summary, notes, excerpt)
left join games g on g.slug = v.game_slug
left join controller_families f on f.slug = v.family_slug;

insert into evidence_sources (url, url_key, source_type, title, review_status, duplicate_of_id, is_demo, reviewed_at)
select 'https://example.com/gameprobe-fixture/ww-rt-repost', 'example.com/gameprobe-fixture/ww-rt-repost', 'forum',
       'Fixture: repost of the RT thread', 'duplicate', id, true, now()
from evidence_sources where url_key = 'example.com/gameprobe-fixture/ww-rt';

insert into evidence_claims (
  source_id, game_id, controller_family_id, controller_as_written, game_version, android_version,
  device_as_written, connection_type, control, result, statement, visibility, reported_on, is_demo
)
select s.id, s.game_id, s.controller_family_id, s.controller_as_written, s.game_version, s.android_version,
       s.device_as_written, s.connection_type, c.control, c.result, s.claim_summary,
       case s.review_status when 'published' then 'published' else 'needs_direct_test' end,
       s.published_on, true
from evidence_sources s
join (values
  ('example.com/gameprobe-fixture/ww-rt', 'triggers', 'broken'),
  ('example.com/gameprobe-fixture/ww-rt', 'face_buttons', 'works'),
  ('example.com/gameprobe-fixture/gi-ds', 'menu', 'works'),
  ('example.com/gameprobe-fixture/gi-ds', 'vibration', 'works'),
  ('example.com/gameprobe-fixture/hsr-ab', 'face_buttons', 'broken')
) as c(url_key, control, result) on c.url_key = s.url_key;
