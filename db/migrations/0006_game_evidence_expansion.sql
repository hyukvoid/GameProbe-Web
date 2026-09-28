-- Phase 2-2: Android game and evidence expansion.
--
-- Twelve more games people search for, each backed by evidence that was fetched and
-- quoted from its source on 2026-09-28 (HTTP 200 on the stored URL). Nothing here
-- rewrites what production already holds: Genshin Impact rows, the direct-test records
-- and every earlier migration are untouched, and each insert is idempotent, so the file
-- can run twice without changing the database the second time.
--
-- Recording rules applied claim by claim:
--   * Statements are verbatim; an ellipsis (...) marks sentences the quote skips, and a
--     quote's own punctuation (including "XBOX ," as the help page writes it) is kept.
--   * A controller family is linked only when the statement names a product that maps to
--     the catalog; controller-unspecified statements keep a NULL family.
--   * connection_type is set only where the statement names the transport itself.
--     "Wireless", and "Bluetooth" inside a product name, are not transports.
--   * Unknown dates stay NULL; relative "Last Updated" stamps are never converted.
--   * source review_status and claim visibility are the same value; every reviewed
--     source is a report (is_report = true).
--
-- Ends with an assertion block: a typo in any slug (which would otherwise silently
-- left-join to NULL) or a miscounted claim rolls the whole file back.

-- 1. Games ---------------------------------------------------------------------

insert into games (slug, name, aliases) values
  ('zenless-zone-zero',   'Zenless Zone Zero',   array['ZZZ']),
  ('call-of-duty-mobile', 'Call of Duty: Mobile', array['CODM']),
  ('diablo-immortal',     'Diablo Immortal',     array[]::text[]),
  ('fortnite',            'Fortnite',            array[]::text[]),
  ('grid-autosport',      'GRID Autosport',      array[]::text[]),
  ('alien-isolation',     'Alien: Isolation',    array[]::text[]),
  ('terraria',            'Terraria',            array[]::text[]),
  ('dead-cells',          'Dead Cells',          array[]::text[]),
  ('stardew-valley',      'Stardew Valley',      array[]::text[]),
  ('brawlhalla',          'Brawlhalla',          array[]::text[]),
  ('roblox',              'Roblox',              array[]::text[]),
  ('minecraft',           'Minecraft',           array[]::text[])
on conflict (slug) do nothing;

-- 2. Sources -------------------------------------------------------------------
-- One row per verified page. Controller detail lives on the claims below, so the
-- source rows carry no family, variant, wording or transport; only the HoYoLAB report
-- records its device and game version at source level, where the review form read them.

insert into evidence_sources (
  url, url_key, source_type, title, published_on, review_status, is_report,
  game_id, device_as_written, device_model_code, game_version,
  claim_summary, review_notes, reviewed_at
)
select s.url, s.url_key, s.source_type, s.title, s.published_on::date, s.review_status, true,
       g.id, s.device_as_written, s.device_model_code, s.game_version,
       s.claim_summary, s.review_notes, now()
from (values
  -- Wuthering Waves (3)
  ('https://wutheringwaves.kurogames.com/en/main/news/detail/4973',
   'wutheringwaves.kurogames.com/en/main/news/detail/4973', 'official',
   'Wuthering Waves Version 3.5 Update Maintenance Notice', '2026-07-03', 'published', 'wuthering-waves',
   null::text, null::text, null::text,
   'Version 3.5 maintenance notice: mobile devices support Xbox series, Xbox Elite series, DualShock 4, DualSense and DualSense Edge over a wireless connection.',
   'Fetched 2026-09-28 (HTTP 200) through the site''s rendered output: the detail URL serves a client-rendered shell, so the statement was read from the rendered article and the title and date from the official news index card. published_on 2026-07-03 is the index-card publication date; the maintenance window itself is 2026-07-10. The claim scope is the mobile list only. connection_type stays NULL: "Wireless connection" states no transport.'),

  ('https://wutheringwaves.kurogames.com/en/main/news/detail/1454',
   'wutheringwaves.kurogames.com/en/main/news/detail/1454', 'official',
   'Version 1.3: To the Shore''s End Patch Notes', '2024-09-29', 'published', 'wuthering-waves',
   null::text, null::text, null::text,
   'Version 1.3 patch notes: mobile wireless controllers are Xbox series, Xbox Elite series, DualShock 4, DualSense and DualSense Edge.',
   'Fetched 2026-09-28 (HTTP 200) through the rendered article. Title and published_on 2024-09-29 come from the official news index card, which carries the version 1.3 maintenance time. The statement is the Controller Support bullet verbatim (the leading dash is a bullet and is dropped). connection_type stays NULL: "Wireless Controllers" names no transport.'),

  ('https://www.siliconera.com/wuthering-waves-mobile-controller-support-explained/',
   'siliconera.com/wuthering-waves-mobile-controller-support-explained', 'article',
   'Wuthering Waves Mobile Controller Support Explained', '2024-05-23', 'published', 'wuthering-waves',
   null::text, null::text, null::text,
   'At publication there was no controller support for the mobile version on either Android or iOS.',
   'Fetched 2026-09-28 (HTTP 200); datePublished 2024-05-23 from the page metadata. Historical claim: the article''s own "At the time of writing" framing stays inside the quote, and the later official controller lists contradict it without either side being deleted. Family-less: no controller is named.'),

  -- Honkai: Star Rail (4)
  ('https://support.hoyoverse.com/hc/en-us/articles/50913723265817-Why-does-my-Nintendo-Switch-controller-not-work-correctly-on-PC',
   'support.hoyoverse.com/hc/en-us/articles/50913723265817-Why-does-my-Nintendo-Switch-controller-not-work-correctly-on-PC',
   'official', 'Why does my Nintendo Switch controller not work correctly on PC?', '2025-09-25',
   'needs_direct_test', 'honkai-star-rail',
   null::text, null::text, null::text,
   'Official help: only XBOX, PS4 and above controllers on PC and iOS; Android is not covered.',
   'Fetched 2026-09-28 (HTTP 200); the page shows September 25, 2025 as its last-updated date, stored as published_on. review_status needs_direct_test: the restriction is stated for PC and iOS, so an Android verdict requires a direct test. Family-less: the sentence is a platform-scope statement, not a controller-specific one, so it must not become a family claim for Android.'),

  ('https://news.codashop.com/ph/honkai-star-rail-controller-support-guide/',
   'news.codashop.com/ph/honkai-star-rail-controller-support-guide', 'article',
   'HSR Controller Support Guide | Codashop Blog PH', '2023-10-04', 'published', 'honkai-star-rail',
   null::text, null::text, null::text,
   'Android controller options are limited to 8bitdo or Xbox, paired over Bluetooth in system settings.',
   'Fetched 2026-09-28 (HTTP 200); page metadata date 2023-10-04. The Android section pairs controllers with "Bluetooth & device connection" and "Make sure Bluetooth is turned on", so the Xbox claim records connection bluetooth. The 8bitdo half of the sentence stays inside the statement: "8bitdo" alone maps to no single catalog family.'),

  ('https://game8.co/games/Honkai-Star-Rail/archives/410784',
   'game8.co/games/Honkai-Star-Rail/archives/410784', 'article',
   'Controller Support Guide - How to Play With a Controller | Honkai: Star Rail｜Game8',
   '2023-07-24', 'published', 'honkai-star-rail',
   null::text, null::text, null::text,
   'For Android, 8bitdo or XBOX controllers; iOS is limited to PS4 and PS5 controllers.',
   'Fetched 2026-09-28 (HTTP 200); byline last updated July 24, 2023 11:40 PM. The quote is the Android line of the support table. connection_type stays NULL: the Android line states no transport. The 8bitdo wording stays inside the statement.'),

  ('https://www.hoyolab.com/article/44806021',
   'hoyolab.com/article/44806021', 'forum',
   'Controller Mode on Tablet', null, 'published', 'honkai-star-rail',
   'Samsung Galaxy Tablet S9 SM-X150', 'SM-X150', '4.2',
   'First-hand report: XboxOne Bluetooth controller works with controller mode on a Galaxy Tab S9 (SM-X150) at version 4.2.',
   'Fetched 2026-09-28 (HTTP 200) through the rendered page. Specs block: Samsung Galaxy Tablet S9 SM-X150, XboxOne Bluetooth controller, ver. 4.2; copied to the claim as written. The byline (04/26) conflicts with the page metadata date (2026-08-21), so published_on stays NULL instead of guessing: the conflict is preserved, not resolved. A first-hand forum report, not an official statement.'),

  -- Zenless Zone Zero (3)
  ('https://support.hoyoverse.com/hc/en-us/articles/51005649349017-What-controllers-and-platforms-are-supported-for-the-game',
   'support.hoyoverse.com/hc/en-us/articles/51005649349017-What-controllers-and-platforms-are-supported-for-the-game',
   'official', 'What controllers and platforms are supported for the game?', '2025-10-08',
   'needs_direct_test', 'zenless-zone-zero',
   null::text, null::text, null::text,
   'Official help: controller support is PC only; mobile devices including Android and iOS are not supported.',
   'Fetched 2026-09-28 (HTTP 200); the page shows October 08, 2025 as its last-updated date, stored as published_on. Family-less: the page''s PC controller list is scoped to PC and must not become Android family claims. review_status needs_direct_test pending a direct Android test.'),

  ('https://automaton-media.com/en/news/zenless-zone-zero-how-to-set-up-a-controller-on-iphone-and-android/',
   'automaton-media.com/en/news/zenless-zone-zero-how-to-set-up-a-controller-on-iphone-and-android',
   'article', 'Zenless Zone Zero: How to set up a controller on iPhone and Android - AUTOMATON WEST',
   '2024-07-08', 'published', 'zenless-zone-zero',
   null::text, null::text, null::text,
   'Xbox One, Xbox Series X|S, DualShock 4 and DualSense controllers connect to phones over USB-C cable or Bluetooth.',
   'Fetched 2026-09-28 (HTTP 200); article dated 2024-07-08. Six claims: three named controllers across the two transports the quoted sentence states, one claim per (controller, transport) pair, each keeping the wording of its list item. Coverage still counts this source once per family.'),

  ('https://zenless.hoyoverse.com/en-us/news/156753',
   'zenless.hoyoverse.com/en-us/news/156753', 'official',
   'Zenless Zone Zero Official Site', '2025-06-06', 'published', 'zenless-zone-zero',
   null::text, null::text, null::text,
   'Version 2.0 note: on mobile the DualSense touchpad-equivalent button is Create.',
   'Fetched 2026-09-28 (HTTP 200) through the rendered site; the served title tag is the site-wide SPA title and is recorded as fetched. published_on 2025-06-06 is the version 2.0 start date the note itself states (UTC+8). connection_type stays NULL: "wireless controller" is product wording, not a stated transport.'),

  -- Call of Duty: Mobile (3)
  ('https://activision.helpshift.com/hc/en/3-cod-mobile/faq/86-what-kind-of-controllers-are-supported/',
   'activision.helpshift.com/hc/en/3-cod-mobile/faq/86-what-kind-of-controllers-are-supported', 'official',
   'What kind of controllers are supported? — CoD Mobile Help Center', null, 'published', 'call-of-duty-mobile',
   null::text, null::text, null::text,
   'Xbox One/Series X|S, DualShock 4 (excluding first generation), DualSense and Backbone One controllers are supported.',
   'Fetched 2026-09-28 (HTTP 200) on activision.helpshift.com; the older callofduty.helpshift.com host no longer serves the page. "Last Updated" appears as a relative day count, so published_on stays NULL. Backbone One stays inside the statement only: it is not a catalog family.'),

  ('https://activision.helpshift.com/hc/en/3-cod-mobile/faq/87-how-do-i-pair-my-controller/',
   'activision.helpshift.com/hc/en/3-cod-mobile/faq/87-how-do-i-pair-my-controller', 'official',
   'How do I pair my controller? — CoD Mobile Help Center', null, 'published', 'call-of-duty-mobile',
   null::text, null::text, null::text,
   'Controllers pair mostly over Bluetooth; some devices may support a direct wired connection.',
   'Fetched 2026-09-28 (HTTP 200). "Last Updated" is a relative day count, so published_on stays NULL. One game-wide claim recording the pairing method: connection bluetooth because Bluetooth is the stated primary method, while the wired remark stays inside the statement as a qualification, not a second claim.'),

  ('https://activision.helpshift.com/hc/en/3-cod-mobile/faq/85-how-do-i-use-a-controller-to-play-call-of-duty-mobile/',
   'activision.helpshift.com/hc/en/3-cod-mobile/faq/85-how-do-i-use-a-controller-to-play-call-of-duty-mobile', 'official',
   'How do I use a controller to play Call of Duty: Mobile? — CoD Mobile Help Center', null, 'published',
   'call-of-duty-mobile',
   null::text, null::text, null::text,
   'Controllers work in multiplayer and battle royale; menus outside a match need the device''s native controls.',
   'Fetched 2026-09-28 (HTTP 200). "Last Updated" is a relative day count, so published_on stays NULL. Two game-wide claims from the page: match modes (controller_support, works) and the menu restriction (control menu, broken).'),

  -- Diablo Immortal (1)
  ('https://news.blizzard.com/en-us/article/23814052/diablo-immortal-cut-down-demons-with-a-controller',
   'news.blizzard.com/en-us/article/23814052/diablo-immortal-cut-down-demons-with-a-controller', 'official',
   'Diablo Immortal: Cut Down Demons with a Controller', '2022-07-14', 'published', 'diablo-immortal',
   null::text, null::text, null::text,
   'Android controller table (Xbox One, Xbox Series X/S, Dualshock 4, DualSense, Elite Series 2, Razer Kishi) plus automatic input detection.',
   'Fetched 2026-09-28 (HTTP 200); article dated July 14, 2022. The six Android Devices rows are quoted verbatim in order; the rows between them are elided with ellipses. connection_type stays NULL on every claim: "Bluetooth" inside a product name is not a stated transport (Genshin sheet rule S4). The Elite row is family xbox with variant NULL and its own wording, matching how production records Elite controllers.'),

  -- Fortnite (2)
  ('https://www.epicgames.com/help/c-34254770/c-33726977/a23146860',
   'epicgames.com/help/c-34254770/c-33726977/a23146860', 'official',
   'How to configure a controller in Fortnite - Fortnite Battle Royale Support', null, 'published', 'fortnite',
   null::text, null::text, null::text,
   'On Android, controller mapping is configured from the Menu button and Gear icon.',
   'Fetched 2026-09-28 (HTTP 200); the locale is a query parameter and the path form resolves as stored. Undated official help article, so published_on stays NULL. Family-less: no controller model is named.'),

  ('https://www.epicgames.com/help/c-34254770/c-33726977/a21785133',
   'epicgames.com/help/c-34254770/c-33726977/a21785133', 'official',
   'What devices can I use to play Fortnite on mobile, console, or PC? - Fortnite Battle Royale Support',
   null, 'published', 'fortnite',
   null::text, null::text, null::text,
   'External devices such as controllers can be used on mobile; compatibility with untested devices is not guaranteed.',
   'Fetched 2026-09-28 (HTTP 200). Undated official help article, so published_on stays NULL. Two quoted sentences joined with an ellipsis; no controller model or transport is named, so the claim is family-less.'),

  -- GRID Autosport (2)
  ('https://www.feralinteractive.com/en/faqs/gridautosport/latest/android/',
   'feralinteractive.com/en/faqs/gridautosport/latest/android', 'official',
   'GRID™ Autosport for mobile - FAQs (Frequently Asked Questions)', null, 'published', 'grid-autosport',
   null::text, null::text, null::text,
   'Tested and recommended gamepads (DUALSHOCK 4, DualSense, Xbox One wireless, Xbox Series X|S wireless, and others); gamepad controls switch automatically on connect.',
   'Fetched 2026-09-28 (HTTP 200). Undated FAQ, so published_on stays NULL. Four claims from the tested-gamepads list, each keeping its own row wording; the two Xbox rows are separate claims. Rotor Riot, SteelSeries Stratus Duo and Ipega stay inside the statement only: none is a catalog family. The automatic-control-switch sentence is a separate game-wide claim.'),

  ('https://www.feralinteractive.com/en/news/take-control-with-the-latest-grid-autosport-patch-for-ios-and-android/',
   'feralinteractive.com/en/news/take-control-with-the-latest-grid-autosport-patch-for-ios-and-android',
   'official', 'Take control with the latest GRID Autosport patch for iOS and Android',
   '2021-10-07', 'published', 'grid-autosport',
   null::text, null::text, null::text,
   'Patch adds support for the DualSense and Xbox One Series X controllers.',
   'Fetched 2026-09-28 (HTTP 200); the headline carries 7 October 2021 in the page heading and time element, stored as published_on. The site title tag is generic, so the title field is the article heading. One claim per named controller, each keeping the quote''s exact wording ("Xbox One Series X" as the patch note writes it).'),

  -- Alien: Isolation (2)
  ('https://www.feralinteractive.com/en/faqs/alienisolation/latest/android/',
   'feralinteractive.com/en/faqs/alienisolation/latest/android', 'official',
   'Alien: Isolation™ for mobile - FAQs (Frequently Asked Questions)', null, 'published', 'alien-isolation',
   null::text, null::text, null::text,
   'Supported: SteelSeries Stratus Duo, DUALSHOCK 4, PS5 DualSense, Xbox One and Series X|S wireless, Razer Kishi; some Xiaomi devices falsely detect a controller.',
   'Fetched 2026-09-28 (HTTP 200). Undated FAQ, so published_on stays NULL. Five claims from the supported-controllers list, each keeping its row wording; SteelSeries Stratus Duo stays inside the statement only. The Xiaomi caveat is a device-scoped family-less broken claim with device_as_written "Xiaomi devices".'),

  ('https://play.google.com/store/apps/details?id=com.feralinteractive.alienisolation_android',
   'play.google.com/store/apps/details?id=com.feralinteractive.alienisolation_android', 'official',
   'Alien: Isolation - Apps on Google Play', null, 'published', 'alien-isolation',
   null::text, null::text, null::text,
   'Play listing: play with a gamepad or any Android-compatible mouse and keyboard.',
   'Fetched 2026-09-28 (HTTP 200). The store''s "Updated on" stamp is app metadata, not a page publication date, so published_on stays NULL. No controller model or transport is named.'),

  -- Terraria (2)
  ('https://play.google.com/store/apps/details?id=com.and.games505.TerrariaPaid',
   'play.google.com/store/apps/details?id=com.and.games505.TerrariaPaid', 'official',
   'Terraria - Apps on Google Play', null, 'published', 'terraria',
   null::text, null::text, null::text,
   'Play listing: fully-remappable gamepad support with a Bluetooth connected gamepad where supported.',
   'Fetched 2026-09-28 (HTTP 200). Store metadata is not a publication date, so published_on stays NULL. connection bluetooth because the listing says "Bluetooth connected gamepad".'),

  ('https://forums.terraria.org/index.php?threads/youve-got-the-touch-youve-got-the-power-controller-customization-update-hits-mobile-terraria-today.87000/',
   'forums.terraria.org/index.php?threads/youve-got-the-touch-youve-got-the-power-controller-customization-update-hits-mobile-terraria-today.87000/=',
   'forum',
   'You''ve got the Touch, You''ve got the Power! Controller & Customization Update hits Mobile Terraria Today! | Terraria Community Forums',
   '2020-04-01', 'published', 'terraria',
   null::text, null::text, null::text,
   'Official forum update: controller remapping for Bluetooth gamepads (Xbox One and PS4 gamepads work); unsupported gamepads crash some Android devices.',
   'Fetched 2026-09-28 (HTTP 200) at the index.php thread URL, the live form of the page; urlKey keeps the query string, which is why the key ends in /=. Post dated April 1, 2020. Two bluetooth family claims from the compatibility sentence, each keeping its own wording, plus one family-less broken claim for the crash report (two sentences joined with an ellipsis).'),

  -- Dead Cells (2)
  ('https://playdigious.helpshift.com/hc/en/7-dead-cells/faq/136-does-dead-cells-have-controller-support/',
   'playdigious.helpshift.com/hc/en/7-dead-cells/faq/136-does-dead-cells-have-controller-support', 'other',
   'Does Dead Cells have controller support? — Dead Cells Help Center', null, 'published', 'dead-cells',
   null::text, null::text, null::text,
   'Dead Cells has controller support on Android, but device and controller diversity keeps compatibility unguaranteed.',
   'Fetched 2026-09-28 (HTTP 200). "Last Updated" appears as a relative day count, so published_on stays NULL. source_type other: a vendor help center, not the publisher''s official site and not editorial. Two non-adjacent sentences are joined with an ellipsis.'),

  ('https://www.androidpolice.com/2020/06/02/dead-cells-is-coming-to-android-after-all/',
   'androidpolice.com/2020/06/02/dead-cells-is-coming-to-android-after-all', 'article',
   'Dead Cells is available on Android a day early at a special launch price', '2020-06-02', 'published',
   'dead-cells',
   null::text, null::text, null::text,
   'Android launch with Bluetooth controller support; a SteelSeries Stratus Duo over Bluetooth was responsive.',
   'Fetched 2026-09-28 (HTTP 200); byline June 2, 2020 agrees with the URL date (JSON-LD datePublished 2020-04-07 predates the article and was not used). connection bluetooth because the quote says "over bluetooth". Two sentences are joined with an ellipsis; SteelSeries Stratus Duo stays inside the statement only: it is not a catalog family.'),

  -- Stardew Valley (2)
  ('https://play.google.com/store/apps/details?id=com.chucklefish.stardewvalley',
   'play.google.com/store/apps/details?id=com.chucklefish.stardewvalley', 'official',
   'Stardew Valley - Apps on Google Play', null, 'published', 'stardew-valley',
   null::text, null::text, null::text,
   'Play listing: external controller support alongside touch-screen and virtual joystick options.',
   'Fetched 2026-09-28 (HTTP 200). Store metadata is not a publication date, so published_on stays NULL. No controller model or transport is named.'),

  ('https://forums.stardewvalley.net/threads/1-6-14-controller-bug.33376/',
   'forums.stardewvalley.net/threads/1-6-14-controller-bug.33376', 'forum',
   'Android - 1.6.14 Controller bug', '2024-11-17', 'published', 'stardew-valley',
   null::text, null::text, null::text,
   'Developer reply: mobile controller support has always been fairly unstable and got worse in 1.6.',
   'Fetched 2026-09-28 (HTTP 200). Post #6 carries a Developer badge and the timestamp November 17, 2024; quoted verbatim. Family-less: no controller is named.'),

  -- Brawlhalla (2)
  ('https://www.androidpolice.com/2020/08/04/brawlhalla-android/',
   'androidpolice.com/2020/08/04/brawlhalla-android', 'article',
   'Ubisoft just released Brawlhalla on the Play Store two days early', '2020-08-04', 'published',
   'brawlhalla',
   null::text, null::text, null::text,
   'A Gamevice over USB and a Steelseries Stratus Duo over Bluetooth both work as expected.',
   'Fetched 2026-09-28 (HTTP 200); dateModified 2020-08-04 agrees with the byline and URL date (JSON-LD datePublished 2019-11-19 predates the Android release and was not used). Two game-wide claims share the quoted sentence, one per transport the sentence states explicitly. Neither Gamevice nor SteelSeries is a catalog family, so both claims stay family-less.'),

  ('https://ee.pocketgamer.com/articles/084083/brawlhalla-review-a-mobile-port-done-right/',
   'ee.pocketgamer.com/articles/084083/brawlhalla-review-a-mobile-port-done-right', 'article',
   'Brawlhalla review - “A mobile port done right”', '2022-05-09', 'published', 'brawlhalla',
   null::text, null::text, null::text,
   'With a controller the gameplay is indistinguishable from consoles; that advantage disappears with a Bluetooth controller on a phone.',
   'Fetched 2026-09-28 (HTTP 200) on the ee.pocketgamer.com article URL; byline May 9, 2022. Two sentences are joined with an ellipsis. connection bluetooth because the second sentence says Bluetooth controller. The controller is unnamed, so the claim is family-less.'),

  -- Roblox (2)
  ('https://devforum.roblox.com/t/android-pointer-capture-support/597829',
   'devforum.roblox.com/t/android-pointer-capture-support/597829', 'forum',
   'Android pointer capture support', '2024-10-25', 'needs_direct_test', 'roblox',
   null::text, null::text, null::text,
   'Report: no full keyboard/mouse or controller support on Android; settings are only partially controller friendly.',
   'Fetched 2026-09-28 (HTTP 200). The quoted post carries the timestamp 2024-10-25, used as published_on. Community report with no official Android statement, so review_status needs_direct_test. Family-less: the quoted text names no controller model.'),

  ('https://devforum.roblox.com/t/xbox-one-controller-does-not-work-properly-on-mobile/454350',
   'devforum.roblox.com/t/xbox-one-controller-does-not-work-properly-on-mobile/454350', 'forum',
   'Xbox One controller does not work properly on mobile', '2020-02-09', 'needs_direct_test', 'roblox',
   null::text, null::text, null::text,
   'Report: button-input bugs on Android, on USB-connected controllers as well as Bluetooth.',
   'Fetched 2026-09-28 (HTTP 200); thread created 2020-02-09, used as published_on. The statement covers both transports, so connection_type stays NULL. Community report, unconfirmed: review_status needs_direct_test. Family-less: the claim records the quoted text, which names no controller model.'),

  -- Minecraft (2)
  ('https://minecraft.wiki/Tutorial:Playing_with_a_controller',
   'minecraft.wiki/Tutorial:Playing_with_a_controller', 'article',
   'Tutorial:Playing with a controller – Minecraft Wiki', null, 'published', 'minecraft',
   null::text, null::text, null::text,
   'Bedrock Edition officially supports game controllers on PC, consoles and mobile, wired or wireless, without third-party tools.',
   'Fetched 2026-09-28 through the render proxy (HTTP 200; a direct bot request is 403 while a normal browser loads the page). The wiki page carries no date, so published_on stays NULL. connection_type stays NULL: the sentence covers wired and wireless together.'),

  ('https://feedback.minecraft.net/hc/en-us/community/posts/44535805719053',
   'feedback.minecraft.net/hc/en-us/community/posts/44535805719053', 'forum',
   'Controller Deadzone & Trigger Reset Issue (Android)', '2026-03-24', 'published', 'minecraft',
   null::text, null::text, null::text,
   'Controller input issues in Minecraft Bedrock (Android): analog triggers and joystick deadzones.',
   'Fetched 2026-09-28 (HTTP 200); the page timestamp is March 24, 2026. Community feedback-portal post recorded as a dated family-less broken claim.')
) as s(url, url_key, source_type, title, published_on, review_status, game_slug,
       device_as_written, device_model_code, game_version, claim_summary, review_notes)
join games g on g.slug = s.game_slug
on conflict (url_key) do nothing;

-- 3. Claims --------------------------------------------------------------------
-- One reviewed statement per row. game_id comes from the source row, so a claim can
-- never drift from the game of the page it was read from.

insert into evidence_claims (
  source_id, game_id, controller_family_id, controller_variant_id, controller_as_written,
  game_version, android_version, device_as_written, device_model_code,
  connection_type, control, result, statement, visibility, reported_on
)
select src.id, src.game_id, f.id, v.id, c.controller_as_written,
       c.game_version, null::text, c.device_as_written, c.device_model_code,
       c.connection_type, c.control, c.result, c.statement, src.review_status, src.published_on
from (values
  -- Wuthering Waves: both official notices list five controllers; "wireless" is scope, not a transport.
  ('wutheringwaves.kurogames.com/en/main/news/detail/4973', 'xbox-wireless-controller', null::text, 'Xbox series', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Mobile devices support the following controllers: Wireless connection: Xbox series, Xbox Elite series, DualShock®4, DualSense®, DualSense Edge™'),
  ('wutheringwaves.kurogames.com/en/main/news/detail/4973', 'xbox-wireless-controller', null::text, 'Xbox Elite series', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Mobile devices support the following controllers: Wireless connection: Xbox series, Xbox Elite series, DualShock®4, DualSense®, DualSense Edge™'),
  ('wutheringwaves.kurogames.com/en/main/news/detail/4973', 'sony-dualshock-4', null::text, 'DualShock®4', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Mobile devices support the following controllers: Wireless connection: Xbox series, Xbox Elite series, DualShock®4, DualSense®, DualSense Edge™'),
  ('wutheringwaves.kurogames.com/en/main/news/detail/4973', 'sony-dualsense', null::text, 'DualSense®', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Mobile devices support the following controllers: Wireless connection: Xbox series, Xbox Elite series, DualShock®4, DualSense®, DualSense Edge™'),
  ('wutheringwaves.kurogames.com/en/main/news/detail/4973', 'sony-dualsense', 'dualsense-edge-wireless-controller', 'DualSense Edge™', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Mobile devices support the following controllers: Wireless connection: Xbox series, Xbox Elite series, DualShock®4, DualSense®, DualSense Edge™'),
  ('wutheringwaves.kurogames.com/en/main/news/detail/1454', 'xbox-wireless-controller', null::text, 'Xbox series', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Wireless Controllers: Xbox series, Xbox Elite series, DualShock®4, DualSense®, DualSense Edge™'),
  ('wutheringwaves.kurogames.com/en/main/news/detail/1454', 'xbox-wireless-controller', null::text, 'Xbox Elite series', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Wireless Controllers: Xbox series, Xbox Elite series, DualShock®4, DualSense®, DualSense Edge™'),
  ('wutheringwaves.kurogames.com/en/main/news/detail/1454', 'sony-dualshock-4', null::text, 'DualShock®4', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Wireless Controllers: Xbox series, Xbox Elite series, DualShock®4, DualSense®, DualSense Edge™'),
  ('wutheringwaves.kurogames.com/en/main/news/detail/1454', 'sony-dualsense', null::text, 'DualSense®', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Wireless Controllers: Xbox series, Xbox Elite series, DualShock®4, DualSense®, DualSense Edge™'),
  ('wutheringwaves.kurogames.com/en/main/news/detail/1454', 'sony-dualsense', 'dualsense-edge-wireless-controller', 'DualSense Edge™', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Wireless Controllers: Xbox series, Xbox Elite series, DualShock®4, DualSense®, DualSense Edge™'),

  -- Wuthering Waves: historical contradiction, kept as written.
  ('siliconera.com/wuthering-waves-mobile-controller-support-explained', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'broken',
   'At the time of writing this, there is no controller support for the mobile version of Wuthering Waves. That means there is no controller support on either Android or iOS at this time.'),

  -- Honkai: Star Rail.
  ('support.hoyoverse.com/hc/en-us/articles/50913723265817-Why-does-my-Nintendo-Switch-controller-not-work-correctly-on-PC', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'broken',
   'Please note that the game only supports XBOX , PS4 and above controllers on PC and iOS.'),
  ('news.codashop.com/ph/honkai-star-rail-controller-support-guide', 'xbox-wireless-controller', null::text, 'Xbox controllers', null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'For Android players, your options for a controller are also limited only to 8bitdo or Xbox controllers.'),
  ('game8.co/games/Honkai-Star-Rail/archives/410784', 'xbox-wireless-controller', null::text, 'XBOX controllers', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'For Android, you can use 8bitdo or XBOX controllers.'),
  ('hoyolab.com/article/44806021', 'xbox-wireless-controller', null::text, 'XboxOne Bluetooth controller', '4.2', 'Samsung Galaxy Tablet S9 SM-X150', 'SM-X150', 'bluetooth', 'controller_support', 'works',
   'I like to run HSR on my Galaxy Android tablet. I have no issues connecting the controller itself, but my problem lies with accessibility. In order to be in controller mode, you must boot up the game and enter the settings menu with the character''s phone.'),

  -- Zenless Zone Zero: official denial kept distinct from the setup article's transports.
  ('support.hoyoverse.com/hc/en-us/articles/51005649349017-What-controllers-and-platforms-are-supported-for-the-game', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'broken',
   'Controller support is currently available only on PC. Mobile devices, including Android and iOS, are not supported at this time.'),
  ('automaton-media.com/en/news/zenless-zone-zero-how-to-set-up-a-controller-on-iphone-and-android', 'xbox-wireless-controller', null::text, 'Xbox One controller, Xbox Series X | S controller', null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'These are the Xbox One controller, the Xbox Series X | S controller, the DualShock 4 (for the PlayStation 4), and the DualSense (for the PlayStation 5) … Controllers can be connected to your phone either with a USB-C cable or wirelessly via Bluetooth.'),
  ('automaton-media.com/en/news/zenless-zone-zero-how-to-set-up-a-controller-on-iphone-and-android', 'xbox-wireless-controller', null::text, 'Xbox One controller, Xbox Series X | S controller', null::text, null::text, null::text, 'usb', 'controller_support', 'works',
   'These are the Xbox One controller, the Xbox Series X | S controller, the DualShock 4 (for the PlayStation 4), and the DualSense (for the PlayStation 5) … Controllers can be connected to your phone either with a USB-C cable or wirelessly via Bluetooth.'),
  ('automaton-media.com/en/news/zenless-zone-zero-how-to-set-up-a-controller-on-iphone-and-android', 'sony-dualshock-4', null::text, 'DualShock 4 (for the PlayStation 4)', null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'These are the Xbox One controller, the Xbox Series X | S controller, the DualShock 4 (for the PlayStation 4), and the DualSense (for the PlayStation 5) … Controllers can be connected to your phone either with a USB-C cable or wirelessly via Bluetooth.'),
  ('automaton-media.com/en/news/zenless-zone-zero-how-to-set-up-a-controller-on-iphone-and-android', 'sony-dualshock-4', null::text, 'DualShock 4 (for the PlayStation 4)', null::text, null::text, null::text, 'usb', 'controller_support', 'works',
   'These are the Xbox One controller, the Xbox Series X | S controller, the DualShock 4 (for the PlayStation 4), and the DualSense (for the PlayStation 5) … Controllers can be connected to your phone either with a USB-C cable or wirelessly via Bluetooth.'),
  ('automaton-media.com/en/news/zenless-zone-zero-how-to-set-up-a-controller-on-iphone-and-android', 'sony-dualsense', null::text, 'DualSense (for the PlayStation 5)', null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'These are the Xbox One controller, the Xbox Series X | S controller, the DualShock 4 (for the PlayStation 4), and the DualSense (for the PlayStation 5) … Controllers can be connected to your phone either with a USB-C cable or wirelessly via Bluetooth.'),
  ('automaton-media.com/en/news/zenless-zone-zero-how-to-set-up-a-controller-on-iphone-and-android', 'sony-dualsense', null::text, 'DualSense (for the PlayStation 5)', null::text, null::text, null::text, 'usb', 'controller_support', 'works',
   'These are the Xbox One controller, the Xbox Series X | S controller, the DualShock 4 (for the PlayStation 4), and the DualSense (for the PlayStation 5) … Controllers can be connected to your phone either with a USB-C cable or wirelessly via Bluetooth.'),
  ('zenless.hoyoverse.com/en-us/news/156753', 'sony-dualsense', null::text, 'DualSense® wireless controller', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'When using the DualSense® wireless controller on mobile devices, the DualSense®''s corresponding button for the PC''s touchpad function is Create.'),

  -- Call of Duty: Mobile.
  ('activision.helpshift.com/hc/en/3-cod-mobile/faq/86-what-kind-of-controllers-are-supported', 'xbox-wireless-controller', null::text, 'Xbox One and Xbox Series X|S controllers', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Call of Duty: Mobile supports the following controllers: Official Xbox One and Xbox Series X|S controllers / DUALSHOCK®4 controllers for PlayStation 4, excluding first generation / DualSense® controllers for PlayStation 5 / Backbone One controllers'),
  ('activision.helpshift.com/hc/en/3-cod-mobile/faq/86-what-kind-of-controllers-are-supported', 'sony-dualshock-4', null::text, 'DUALSHOCK®4 controllers for PlayStation 4, excluding first generation', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Call of Duty: Mobile supports the following controllers: Official Xbox One and Xbox Series X|S controllers / DUALSHOCK®4 controllers for PlayStation 4, excluding first generation / DualSense® controllers for PlayStation 5 / Backbone One controllers'),
  ('activision.helpshift.com/hc/en/3-cod-mobile/faq/86-what-kind-of-controllers-are-supported', 'sony-dualsense', null::text, 'DualSense® controllers for PlayStation 5', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Call of Duty: Mobile supports the following controllers: Official Xbox One and Xbox Series X|S controllers / DUALSHOCK®4 controllers for PlayStation 4, excluding first generation / DualSense® controllers for PlayStation 5 / Backbone One controllers'),
  ('activision.helpshift.com/hc/en/3-cod-mobile/faq/87-how-do-i-pair-my-controller', null::text, null::text, null::text, null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'Most controllers are paired via Bluetooth, however some devices may support a direct wired controller.'),
  ('activision.helpshift.com/hc/en/3-cod-mobile/faq/85-how-do-i-use-a-controller-to-play-call-of-duty-mobile', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Call of Duty: Mobile supports the use of controllers in Multiplayer and Battle Royale game modes.'),
  ('activision.helpshift.com/hc/en/3-cod-mobile/faq/85-how-do-i-use-a-controller-to-play-call-of-duty-mobile', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'menu', 'broken',
   'Controllers are intended for use in matches. To navigate other menus outside a match such as lobbies, settings, and loadouts, you will need to use your device’s native controls.'),

  -- Diablo Immortal: wide detection claim plus the six Android Devices rows.
  ('news.blizzard.com/en-us/article/23814052/diablo-immortal-cut-down-demons-with-a-controller', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'That means, as soon as you connect a controller to your mobile device or PC, Immortal will sense this and automatically adjust for this input.'),
  ('news.blizzard.com/en-us/article/23814052/diablo-immortal-cut-down-demons-with-a-controller', 'xbox-wireless-controller', null::text, 'Xbox One Wireless Bluetooth Controller', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Android Devices: Xbox One Wireless Bluetooth Controller / Xbox Series X/S Bluetooth Controller … Sony Dualshock 4 / Sony DualSense Wireless Controller (PS5) / Xbox Elite Controller Series 2 … Razer Kishi'),
  ('news.blizzard.com/en-us/article/23814052/diablo-immortal-cut-down-demons-with-a-controller', 'xbox-wireless-controller', null::text, 'Xbox Series X/S Bluetooth Controller', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Android Devices: Xbox One Wireless Bluetooth Controller / Xbox Series X/S Bluetooth Controller … Sony Dualshock 4 / Sony DualSense Wireless Controller (PS5) / Xbox Elite Controller Series 2 … Razer Kishi'),
  ('news.blizzard.com/en-us/article/23814052/diablo-immortal-cut-down-demons-with-a-controller', 'sony-dualshock-4', null::text, 'Sony Dualshock 4', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Android Devices: Xbox One Wireless Bluetooth Controller / Xbox Series X/S Bluetooth Controller … Sony Dualshock 4 / Sony DualSense Wireless Controller (PS5) / Xbox Elite Controller Series 2 … Razer Kishi'),
  ('news.blizzard.com/en-us/article/23814052/diablo-immortal-cut-down-demons-with-a-controller', 'sony-dualsense', null::text, 'Sony DualSense Wireless Controller (PS5)', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Android Devices: Xbox One Wireless Bluetooth Controller / Xbox Series X/S Bluetooth Controller … Sony Dualshock 4 / Sony DualSense Wireless Controller (PS5) / Xbox Elite Controller Series 2 … Razer Kishi'),
  ('news.blizzard.com/en-us/article/23814052/diablo-immortal-cut-down-demons-with-a-controller', 'xbox-wireless-controller', null::text, 'Xbox Elite Controller Series 2', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Android Devices: Xbox One Wireless Bluetooth Controller / Xbox Series X/S Bluetooth Controller … Sony Dualshock 4 / Sony DualSense Wireless Controller (PS5) / Xbox Elite Controller Series 2 … Razer Kishi'),
  ('news.blizzard.com/en-us/article/23814052/diablo-immortal-cut-down-demons-with-a-controller', 'razer-kishi', null::text, 'Razer Kishi', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Android Devices: Xbox One Wireless Bluetooth Controller / Xbox Series X/S Bluetooth Controller … Sony Dualshock 4 / Sony DualSense Wireless Controller (PS5) / Xbox Elite Controller Series 2 … Razer Kishi'),

  -- Fortnite: configuration and device policy, no controller named.
  ('epicgames.com/help/c-34254770/c-33726977/a23146860', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'On Android, press the Menu button and then the Gear icon … Go to the Controller Mapping page.'),
  ('epicgames.com/help/c-34254770/c-33726977/a21785133', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'You can mix and match your external devices (controllers, keyboards, mic, etc.) when you play Fortnite on your mobile device, PC or console. … We aren''t able to test all devices, so some may not be compatible with your mobile device or console.'),

  -- GRID Autosport: tested rows one claim each, plus the automatic switch.
  ('feralinteractive.com/en/faqs/gridautosport/latest/android', 'sony-dualshock-4', null::text, 'Sony PlayStation DUALSHOCK 4', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'The following gamepads have been tested and are recommended: Sony PlayStation DUALSHOCK 4 / Sony PlayStation DualSense / Xbox One Wireless / Xbox Series X|S Wireless / Rotor Riot / SteelSeries Stratus Duo / Ipega (tested 9076, 9156, 9090, 9116, 9021S, 9083S, 9127B, 9099)'),
  ('feralinteractive.com/en/faqs/gridautosport/latest/android', 'sony-dualsense', null::text, 'Sony PlayStation DualSense', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'The following gamepads have been tested and are recommended: Sony PlayStation DUALSHOCK 4 / Sony PlayStation DualSense / Xbox One Wireless / Xbox Series X|S Wireless / Rotor Riot / SteelSeries Stratus Duo / Ipega (tested 9076, 9156, 9090, 9116, 9021S, 9083S, 9127B, 9099)'),
  ('feralinteractive.com/en/faqs/gridautosport/latest/android', 'xbox-wireless-controller', null::text, 'Xbox One Wireless', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'The following gamepads have been tested and are recommended: Sony PlayStation DUALSHOCK 4 / Sony PlayStation DualSense / Xbox One Wireless / Xbox Series X|S Wireless / Rotor Riot / SteelSeries Stratus Duo / Ipega (tested 9076, 9156, 9090, 9116, 9021S, 9083S, 9127B, 9099)'),
  ('feralinteractive.com/en/faqs/gridautosport/latest/android', 'xbox-wireless-controller', null::text, 'Xbox Series X|S Wireless', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'The following gamepads have been tested and are recommended: Sony PlayStation DUALSHOCK 4 / Sony PlayStation DualSense / Xbox One Wireless / Xbox Series X|S Wireless / Rotor Riot / SteelSeries Stratus Duo / Ipega (tested 9076, 9156, 9090, 9116, 9021S, 9083S, 9127B, 9099)'),
  ('feralinteractive.com/en/faqs/gridautosport/latest/android', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'To play GRID Autosport with a gamepad, connect your gamepad to your device and then launch the game; it will automatically switch to gamepad controls.'),
  ('feralinteractive.com/en/news/take-control-with-the-latest-grid-autosport-patch-for-ios-and-android', 'sony-dualsense', null::text, 'DualSense', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'This patch also adds support for the DualSense and Xbox One Series X controllers'),
  ('feralinteractive.com/en/news/take-control-with-the-latest-grid-autosport-patch-for-ios-and-android', 'xbox-wireless-controller', null::text, 'Xbox One Series X', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'This patch also adds support for the DualSense and Xbox One Series X controllers'),

  -- Alien: Isolation: supported list plus the Xiaomi caveat.
  ('feralinteractive.com/en/faqs/alienisolation/latest/android', 'sony-dualshock-4', null::text, 'DUALSHOCK 4', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'The following controllers are officially supported: SteelSeries Stratus Duo / DUALSHOCK 4 / Sony PS5 DualSense / Microsoft Xbox One Wireless / Microsoft Xbox Series X/S Wireless / Razer Kishi'),
  ('feralinteractive.com/en/faqs/alienisolation/latest/android', 'sony-dualsense', null::text, 'Sony PS5 DualSense', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'The following controllers are officially supported: SteelSeries Stratus Duo / DUALSHOCK 4 / Sony PS5 DualSense / Microsoft Xbox One Wireless / Microsoft Xbox Series X/S Wireless / Razer Kishi'),
  ('feralinteractive.com/en/faqs/alienisolation/latest/android', 'xbox-wireless-controller', null::text, 'Microsoft Xbox One Wireless', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'The following controllers are officially supported: SteelSeries Stratus Duo / DUALSHOCK 4 / Sony PS5 DualSense / Microsoft Xbox One Wireless / Microsoft Xbox Series X/S Wireless / Razer Kishi'),
  ('feralinteractive.com/en/faqs/alienisolation/latest/android', 'xbox-wireless-controller', null::text, 'Microsoft Xbox Series X/S Wireless', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'The following controllers are officially supported: SteelSeries Stratus Duo / DUALSHOCK 4 / Sony PS5 DualSense / Microsoft Xbox One Wireless / Microsoft Xbox Series X/S Wireless / Razer Kishi'),
  ('feralinteractive.com/en/faqs/alienisolation/latest/android', 'razer-kishi', null::text, 'Razer Kishi', null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'The following controllers are officially supported: SteelSeries Stratus Duo / DUALSHOCK 4 / Sony PS5 DualSense / Microsoft Xbox One Wireless / Microsoft Xbox Series X/S Wireless / Razer Kishi'),
  ('feralinteractive.com/en/faqs/alienisolation/latest/android', null::text, null::text, null::text, null::text, 'Xiaomi devices', null::text, null::text, 'controller_support', 'broken',
   'On some Xiaomi devices it has been reported that an external controller may be falsely detected, disabling touch input.'),
  ('play.google.com/store/apps/details?id=com.feralinteractive.alienisolation_android', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Resize and reposition on-screen buttons and joysticks, or play with a gamepad or any Android-compatible mouse & keyboard.'),

  -- Terraria.
  ('play.google.com/store/apps/details?id=com.and.games505.TerrariaPaid', null::text, null::text, null::text, null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'Gamepad support – including fully-remappable buttons - Play with your Bluetooth connected gamepad where supported.'),
  ('forums.terraria.org/index.php?threads/youve-got-the-touch-youve-got-the-power-controller-customization-update-hits-mobile-terraria-today.87000/=', 'xbox-wireless-controller', null::text, 'Xbox One', null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'We do not have an exhaustive list of compatible controllers, but for example, bluetooth-capable Xbox One and PlayStation 4 gamepads do work well.'),
  ('forums.terraria.org/index.php?threads/youve-got-the-touch-youve-got-the-power-controller-customization-update-hits-mobile-terraria-today.87000/=', 'sony-dualshock-4', null::text, 'PlayStation 4 gamepads', null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'We do not have an exhaustive list of compatible controllers, but for example, bluetooth-capable Xbox One and PlayStation 4 gamepads do work well.'),
  ('forums.terraria.org/index.php?threads/youve-got-the-touch-youve-got-the-power-controller-customization-update-hits-mobile-terraria-today.87000/=', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'broken',
   'We are aware of some crash issues occurring with certain gamepads and Android devices … These crashes are due to the use of currently-unsupported Gamepads, and this only impacts Android.'),

  -- Dead Cells.
  ('playdigious.helpshift.com/hc/en/7-dead-cells/faq/136-does-dead-cells-have-controller-support', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Yes, Dead cells does have controller support. … Because the market is highly diversified on Android in terms of devices and controllers, we cannot garantee compatibility between all of them but most big brands controllers should work.'),
  ('androidpolice.com/2020/06/02/dead-cells-is-coming-to-android-after-all', null::text, null::text, null::text, null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'Includes Bluetooth controller support … I connected my SteelSeries Stratus Duo to my OP 7 Pro over bluetooth, and the controls were very responsive.'),

  -- Stardew Valley.
  ('play.google.com/store/apps/details?id=com.chucklefish.stardewvalley', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Play the game your way with multiple controls options, such as touch-screen, virtual joystick, and external controller support.'),
  ('forums.stardewvalley.net/threads/1-6-14-controller-bug.33376', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'broken',
   'Controller support on mobile has always been fairly unstable, and we''re aware it got worse in 1.6 as well.'),

  -- Brawlhalla.
  ('androidpolice.com/2020/08/04/brawlhalla-android', null::text, null::text, null::text, null::text, null::text, null::text, 'usb', 'controller_support', 'works',
   'I have tested a Gamevice over USB and a Steelseries Stratus Duo over bluetooth, and both work as expected'),
  ('androidpolice.com/2020/08/04/brawlhalla-android', null::text, null::text, null::text, null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'I have tested a Gamevice over USB and a Steelseries Stratus Duo over bluetooth, and both work as expected'),
  ('ee.pocketgamer.com/articles/084083/brawlhalla-review-a-mobile-port-done-right', null::text, null::text, null::text, null::text, null::text, null::text, 'bluetooth', 'controller_support', 'works',
   'With a controller, the gameplay is indistinguishable from consoles. … that advantage disappears when playing on your phone with a Bluetooth controller'),

  -- Roblox: community reports, flagged for a direct test.
  ('devforum.roblox.com/t/android-pointer-capture-support/597829', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'broken',
   'Roblox doesn’t fully support either KBM or Controller on android. You can’t use a controller in the homepage and in-game, the settings are only partially controller friendly.'),
  ('devforum.roblox.com/t/xbox-one-controller-does-not-work-properly-on-mobile/454350', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'broken',
   'These input bugs are seen on Android devices. … These input bugs are seen on USB-connected controllers as well (not just Bluetooth.)'),

  -- Minecraft.
  ('minecraft.wiki/Tutorial:Playing_with_a_controller', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'works',
   'Minecraft: Bedrock Edition officially supports game controllers. You can play the game with controllers directly on your PC, consoles, and mobile devices, either wired or wireless, and without the need to use third-party tools.'),
  ('feedback.minecraft.net/hc/en-us/community/posts/44535805719053', null::text, null::text, null::text, null::text, null::text, null::text, null::text, 'controller_support', 'broken',
   'I’m experiencing issues with controller input in Minecraft Bedrock (Android), especially with analog triggers and joystick deadzones.')
) as c(url_key, family_slug, variant_slug, controller_as_written, game_version,
       device_as_written, device_model_code, connection_type, control, result, statement)
join evidence_sources src on src.url_key = c.url_key
left join controller_families f on f.slug = c.family_slug
left join controller_variants v on v.slug = c.variant_slug
on conflict do nothing;

-- 4. Verification --------------------------------------------------------------
-- Count only the rows this migration owns, so the check also passes on databases that
-- already held evidence. A wrong slug left-joins to NULL and shifts these counts; a
-- statement over 280 characters fails its check; either way the transaction rolls back
-- and the file stays unrecorded.

do $$
declare
  slugs text[] := array[
    'zenless-zone-zero', 'call-of-duty-mobile', 'diablo-immortal', 'fortnite',
    'grid-autosport', 'alien-isolation', 'terraria', 'dead-cells',
    'stardew-valley', 'brawlhalla', 'roblox', 'minecraft'
  ];
  keys text[] := array[
    'wutheringwaves.kurogames.com/en/main/news/detail/4973',
    'wutheringwaves.kurogames.com/en/main/news/detail/1454',
    'siliconera.com/wuthering-waves-mobile-controller-support-explained',
    'support.hoyoverse.com/hc/en-us/articles/50913723265817-Why-does-my-Nintendo-Switch-controller-not-work-correctly-on-PC',
    'news.codashop.com/ph/honkai-star-rail-controller-support-guide',
    'game8.co/games/Honkai-Star-Rail/archives/410784',
    'hoyolab.com/article/44806021',
    'support.hoyoverse.com/hc/en-us/articles/51005649349017-What-controllers-and-platforms-are-supported-for-the-game',
    'automaton-media.com/en/news/zenless-zone-zero-how-to-set-up-a-controller-on-iphone-and-android',
    'zenless.hoyoverse.com/en-us/news/156753',
    'activision.helpshift.com/hc/en/3-cod-mobile/faq/86-what-kind-of-controllers-are-supported',
    'activision.helpshift.com/hc/en/3-cod-mobile/faq/87-how-do-i-pair-my-controller',
    'activision.helpshift.com/hc/en/3-cod-mobile/faq/85-how-do-i-use-a-controller-to-play-call-of-duty-mobile',
    'news.blizzard.com/en-us/article/23814052/diablo-immortal-cut-down-demons-with-a-controller',
    'epicgames.com/help/c-34254770/c-33726977/a23146860',
    'epicgames.com/help/c-34254770/c-33726977/a21785133',
    'feralinteractive.com/en/faqs/gridautosport/latest/android',
    'feralinteractive.com/en/news/take-control-with-the-latest-grid-autosport-patch-for-ios-and-android',
    'feralinteractive.com/en/faqs/alienisolation/latest/android',
    'play.google.com/store/apps/details?id=com.feralinteractive.alienisolation_android',
    'play.google.com/store/apps/details?id=com.and.games505.TerrariaPaid',
    'forums.terraria.org/index.php?threads/youve-got-the-touch-youve-got-the-power-controller-customization-update-hits-mobile-terraria-today.87000/=',
    'playdigious.helpshift.com/hc/en/7-dead-cells/faq/136-does-dead-cells-have-controller-support',
    'androidpolice.com/2020/06/02/dead-cells-is-coming-to-android-after-all',
    'play.google.com/store/apps/details?id=com.chucklefish.stardewvalley',
    'forums.stardewvalley.net/threads/1-6-14-controller-bug.33376',
    'androidpolice.com/2020/08/04/brawlhalla-android',
    'ee.pocketgamer.com/articles/084083/brawlhalla-review-a-mobile-port-done-right',
    'devforum.roblox.com/t/android-pointer-capture-support/597829',
    'devforum.roblox.com/t/xbox-one-controller-does-not-work-properly-on-mobile/454350',
    'minecraft.wiki/Tutorial:Playing_with_a_controller',
    'feedback.minecraft.net/hc/en-us/community/posts/44535805719053'
  ];
  games_n int;
  sources_n int;
  official_sources_n int;
  published_sources_n int;
  ndt_sources_n int;
  unreported_n int;
  claims_n int;
  published_claims_n int;
  ndt_claims_n int;
  familyless_n int;
  xbox_n int;
  ds4_n int;
  sense_n int;
  kishi_n int;
  variant_n int;
  connection_n int;
  broken_n int;
  menu_n int;
  visibility_mismatch_n int;
  game_mismatch_n int;
begin
  select count(*) into games_n from games where slug = any(slugs);

  select count(*),
         count(*) filter (where source_type = 'official'),
         count(*) filter (where review_status = 'published'),
         count(*) filter (where review_status = 'needs_direct_test'),
         count(*) filter (where is_report is not true)
  into sources_n, official_sources_n, published_sources_n, ndt_sources_n, unreported_n
  from evidence_sources
  where url_key = any(keys);

  -- Owned claims only: every count below is limited to this migration's sources, so a
  -- database that already held evidence passes unchanged.
  select count(*),
         count(*) filter (where c.visibility = 'published'),
         count(*) filter (where c.visibility = 'needs_direct_test'),
         count(*) filter (where c.controller_family_id is null),
         count(*) filter (where f.slug = 'xbox-wireless-controller'),
         count(*) filter (where f.slug = 'sony-dualshock-4'),
         count(*) filter (where f.slug = 'sony-dualsense'),
         count(*) filter (where f.slug = 'razer-kishi'),
         count(*) filter (where c.controller_variant_id is not null),
         count(*) filter (where c.connection_type is not null),
         count(*) filter (where c.result = 'broken'),
         count(*) filter (where c.control = 'menu'),
         count(*) filter (where c.visibility <> s.review_status),
         count(*) filter (where c.game_id is distinct from s.game_id)
  into claims_n, published_claims_n, ndt_claims_n, familyless_n, xbox_n, ds4_n, sense_n, kishi_n,
       variant_n, connection_n, broken_n, menu_n, visibility_mismatch_n, game_mismatch_n
  from evidence_claims c
  join evidence_sources s on s.id = c.source_id
  left join controller_families f on f.id = c.controller_family_id
  where s.url_key = any(keys);

  if games_n <> 12 then
    raise exception '0006: expected 12 games, found %', games_n;
  end if;
  if sources_n <> 32 then
    raise exception '0006: expected 32 sources, found %', sources_n;
  end if;
  if official_sources_n <> 17 then
    raise exception '0006: expected 17 official sources, found %', official_sources_n;
  end if;
  if published_sources_n <> 28 or ndt_sources_n <> 4 then
    raise exception '0006: expected 28 published + 4 needs_direct_test sources, found % + %',
      published_sources_n, ndt_sources_n;
  end if;
  if unreported_n <> 0 then
    raise exception '0006: % sources violate the report check (is_report)', unreported_n;
  end if;
  if claims_n <> 67 then
    raise exception '0006: expected 67 claims, found %', claims_n;
  end if;
  if published_claims_n <> 63 or ndt_claims_n <> 4 then
    raise exception '0006: expected 63 published + 4 needs_direct_test claims, found % + %',
      published_claims_n, ndt_claims_n;
  end if;
  if familyless_n <> 25 then
    raise exception '0006: expected 25 family-less claims, found % (a slug typo?)', familyless_n;
  end if;
  if xbox_n <> 19 or ds4_n <> 9 or sense_n <> 12 or kishi_n <> 2 then
    raise exception '0006: family counts xbox % (want 19), dualshock-4 % (want 9), dualsense % (want 12), kishi % (want 2)',
      xbox_n, ds4_n, sense_n, kishi_n;
  end if;
  if variant_n <> 2 then
    raise exception '0006: expected 2 variant-linked claims, found %', variant_n;
  end if;
  if connection_n <> 16 then
    raise exception '0006: expected 16 connection-scoped claims, found %', connection_n;
  end if;
  if broken_n <> 10 then
    raise exception '0006: expected 10 broken claims, found %', broken_n;
  end if;
  if menu_n <> 1 then
    raise exception '0006: expected 1 menu claim, found %', menu_n;
  end if;
  if visibility_mismatch_n <> 0 then
    raise exception '0006: % claims disagree with their source review_status', visibility_mismatch_n;
  end if;
  if game_mismatch_n <> 0 then
    raise exception '0006: % claims disagree with their source game', game_mismatch_n;
  end if;
end $$;
