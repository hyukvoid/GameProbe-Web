-- Production catalog: the games GameProbe covers and controllers people can pick in the
-- test form. These are product names, not compatibility data. Controller names match
-- the manufacturers' own product pages. Anything else can be entered as free text.

insert into games (slug, name, aliases) values
  ('wuthering-waves',  'Wuthering Waves',   array['WuWa']),
  ('genshin-impact',   'Genshin Impact',    array['Genshin']),
  ('honkai-star-rail', 'Honkai: Star Rail', array['HSR', 'Star Rail', 'Honkai Star Rail']);

insert into controller_families (slug, manufacturer, name) values
  ('sony-dualsense',            'Sony',      'DualSense'),
  ('sony-dualshock-4',          'Sony',      'DualShock 4'),
  ('xbox-wireless-controller',  'Microsoft', 'Xbox Wireless Controller'),
  ('8bitdo-ultimate',           '8BitDo',    '8BitDo Ultimate'),
  ('8bitdo-ultimate-2c',        '8BitDo',    '8BitDo Ultimate 2C'),
  ('8bitdo-ultimate-2',         '8BitDo',    '8BitDo Ultimate 2'),
  ('razer-kishi',               'Razer',     'Razer Kishi'),
  ('gamesir-g8',                'GameSir',   'GameSir G8');

insert into controller_variants (family_id, slug, name)
select f.id, v.slug, v.name
from (values
  ('sony-dualsense',           'dualsense-wireless-controller',      'DualSense Wireless Controller'),
  ('sony-dualsense',           'dualsense-edge-wireless-controller', 'DualSense Edge Wireless Controller'),
  ('sony-dualshock-4',         'dualshock-4-cuh-zct1',               'DualShock 4 (CUH-ZCT1)'),
  ('sony-dualshock-4',         'dualshock-4-cuh-zct2',               'DualShock 4 (CUH-ZCT2)'),
  ('xbox-wireless-controller', 'xbox-wireless-controller-model-1708', 'Xbox Wireless Controller (Model 1708)'),
  ('xbox-wireless-controller', 'xbox-wireless-controller-model-1914', 'Xbox Wireless Controller (Model 1914)'),
  ('xbox-wireless-controller', 'xbox-elite-series-2-model-1797',     'Xbox Elite Wireless Controller Series 2 (Model 1797)'),
  ('8bitdo-ultimate',          '8bitdo-ultimate-bluetooth',          '8BitDo Ultimate Bluetooth Controller'),
  ('8bitdo-ultimate',          '8bitdo-ultimate-2-4g',               '8BitDo Ultimate 2.4G Controller'),
  ('8bitdo-ultimate-2c',       '8bitdo-ultimate-2c-wireless',        '8BitDo Ultimate 2C Wireless Controller'),
  ('8bitdo-ultimate-2c',       '8bitdo-ultimate-2c-bluetooth',       '8BitDo Ultimate 2C Bluetooth Controller'),
  ('8bitdo-ultimate-2',        '8bitdo-ultimate-2-wireless',         '8BitDo Ultimate 2 Wireless Controller'),
  ('8bitdo-ultimate-2',        '8bitdo-ultimate-2-bluetooth',        '8BitDo Ultimate 2 Bluetooth Controller'),
  ('razer-kishi',              'razer-kishi-v2',                     'Razer Kishi V2'),
  ('razer-kishi',              'razer-kishi-ultra',                  'Razer Kishi Ultra'),
  ('gamesir-g8',               'gamesir-g8-galileo',                 'GameSir G8 Galileo')
) as v(family_slug, slug, name)
join controller_families f on f.slug = v.family_slug;
