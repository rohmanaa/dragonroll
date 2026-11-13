-- Katalog 7 pet dari referensi/newgui/game/data pet.html.
-- Jalankan seluruh file ini di Supabase SQL Editor. Aman dijalankan ulang.

create table if not exists public.pet_catalog (
  id              text primary key,
  tier            smallint not null unique check (tier between 1 and 7),
  tier_name       text not null,
  name            text not null,
  material        text not null,
  identity        text not null,
  role            text not null,
  skill           jsonb not null check (jsonb_typeof(skill) = 'object'),
  advantage       text not null,
  visual          text not null,
  animations      text[] not null default '{}',
  effects         text not null,
  sounds          text[] not null default '{}',
  palette         text[] not null default '{}',
  accent_color    text not null,
  lore            text not null,
  price_currency  text not null check (price_currency in ('coin', 'emerald')),
  price_amount    integer not null check (price_amount > 0),
  updated_at      timestamptz not null default now()
);

alter table public.pet_catalog enable row level security;
revoke all on public.pet_catalog from public, anon, authenticated;
grant select on public.pet_catalog to anon, authenticated;

drop policy if exists pet_catalog_read on public.pet_catalog;
create policy pet_catalog_read
  on public.pet_catalog
  for select
  to anon, authenticated
  using (true);

insert into public.pet_catalog (
  id, tier, tier_name, name, material, identity, role, skill, advantage,
  visual, animations, effects, sounds, palette, accent_color, lore,
  price_currency, price_amount
) values
  (
    'forest_pup', 1, 'Common', 'Forest Pup', 'Oak Wood dan Daun', 'Ramah dan setia', 'Pengendus',
    '{"name":"Hidung Penuntun","type":"passive","effect":"Saat digigit ular, mundur 1 kotak lebih sedikit (minimal tetap mundur 1).","limit":"Tanpa batas","params":{"snake_penalty_reduction":1}}'::jsonb,
    'Stabil dan mudah dipakai pemula. Mengurangi kerugian kecil secara konsisten.',
    'Anak anjing hutan berbulu cokelat dan krem, kalung kulit dengan papan kayu, ranting daun di kepala.',
    array['bernapas','kepala miring','ekor mengibas','telinga bergoyang','lidah terjulur','berkedip'],
    'Daun hijau jatuh pelan, jarang.',
    array['guk guk','yip pendek','rengekan'],
    array['#b8803f','#f0dcb0','#3fa04a'],
    '#6fd05a',
    'Anak anjing hutan dengan kalung papan kayu. Gerakannya sederhana: bernapas, mengibas ekor, berkedip.',
    'coin', 100000
  ),
  (
    'copper_golem', 2, 'Uncommon', 'Copper Golem', 'Copper Block dan Verdigris', 'Industrial dan rajin', 'Pelindung',
    '{"name":"Perisai Tembaga","type":"active","effect":"Menahan 1 gigitan ular sehingga pemain tidak turun.","limit":"1 kali per game","params":{"snake_bites_blocked":1,"uses_per_game":1}}'::jsonb,
    'Pertahanan yang pasti. Cocok untuk menyelamatkan posisi di dekat garis akhir.',
    'Golem tembaga dengan bercak karat hijau, panel pengukur di dada, roda gigi di punggung, antena berlampu oranye.',
    array['roda gigi berputar','jarum pengukur bergerak','lengan mengayun','kepala menoleh','lampu antena berdenyut'],
    'Uap putih dari pipa bahu, percikan tembaga.',
    array['denting logam','desis uap','bunyi servo'],
    array['#c8703a','#3fbf9f','#ffb040'],
    '#ff9a30',
    'Golem tembaga dengan bercak karat hijau, panel pengukur di dada, dan roda gigi di punggung.',
    'coin', 250000
  ),
  (
    'crystal_axolotl', 3, 'Rare', 'Crystal Axolotl', 'Diamond Crystal', 'Tenang dan berkilau', 'Penyembuh',
    '{"name":"Regenerasi Kristal","type":"passive","effect":"Setelah turun karena ular, otomatis maju +2 kotak di giliran berikutnya.","limit":"Tanpa batas","params":{"bonus_move_after_snake":2}}'::jsonb,
    'Memperkecil kerugian dari ular. Kuat untuk permainan panjang.',
    'Axolotl biru es dengan insang merah muda berujung kristal, kristal tumbuh di punggung, permata di dahi.',
    array['mengambang naik turun','ekor berombak','insang bergetar','kristal berdenyut','berkedip'],
    'Gelembung dan kilau kristal naik ke atas.',
    array['gelembung','lonceng air','cicit pendek'],
    array['#8fe8f2','#d8fbff','#ff9ad8','#40e8f4'],
    '#40e8f4',
    'Axolotl berwarna es dengan kristal tumbuh di punggung dan permata di dahi. Mengambang pelan di atas panggung.',
    'coin', 600000
  ),
  (
    'arcane_owl', 4, 'Epic', 'Arcane Owl', 'Amethyst dan Rune', 'Bijak dan arcane', 'Peramal',
    '{"name":"Mata Ramalan","type":"active","effect":"Melihat hasil dadu berikutnya dan boleh menggesernya 1 angka ke atas atau ke bawah.","limit":"Jeda 3 giliran","params":{"dice_adjust":1,"cooldown_turns":3}}'::jsonb,
    'Bisa mengatur langkah dengan perhitungan, misalnya menghindari kotak ular atau mengejar tangga.',
    'Burung hantu ungu bertengger di gugus amethyst, mata emas bercahaya, dua cincin rune di belakang kepala.',
    array['kepala menoleh lebar','sayap berkedip','cincin rune berputar berlawanan','kristal mengorbit','berkedip'],
    'Kilau ungu naik pelan.',
    array['hu-hu','denting arcane','kepakan sayap'],
    array['#6a4a7a','#b46af0','#ffd24a'],
    '#b46af0',
    'Burung hantu bertengger di gugus amethyst. Dua cincin rune berputar berlawanan di belakang kepalanya.',
    'coin', 1500000
  ),
  (
    'storm_wolf', 5, 'Legendary', 'Storm Wolf', 'Storm Steel dan Lightning Crystal', 'Thunder Lord', 'Penyerang',
    '{"name":"Sambaran Badai","type":"active","effect":"Pilih salah satu: lawan terdekat mundur 3 kotak, atau lempar dadu dua kali dan ambil yang terbesar.","limit":"3 kali per game, jeda 4 giliran","params":{"push_back":3,"alt_roll_twice_take_max":true,"uses_per_game":3,"cooldown_turns":4}}'::jsonb,
    'Satu-satunya pet yang menekan lawan. Bisa membalik keadaan saat tertinggal.',
    'Serigala baja kebiruan dengan surai duri petir kuning, mata biru menyala, garis listrik di kaki. Awan badai melayang di atasnya.',
    array['bernapas','kepala menoleh','ekor bergelombang','telinga bergerak','surai berdenyut','petir menyambar dari awan'],
    'Percikan listrik dari surai, kilat dari awan ke tanah atau surai.',
    array['lolongan','guntur','setrum'],
    array['#5a6a8a','#e8f4ff','#7fd0ff','#fff2a0'],
    '#7fd0ff',
    'Serigala baja dengan surai duri petir. Awan badai di atasnya menyambar tanah dan surainya secara acak.',
    'coin', 4000000
  ),
  (
    'inferno_dragon', 6, 'Mythic', 'Inferno Dragon', 'Dragon Scale dan Obsidian', 'Dragon Lord', 'Pembakar Ular',
    '{"name":"Napas Api","type":"active","effect":"Menghanguskan 1 ular di jalurmu. Ular itu tidak aktif selama 3 giliran.","limit":"1 kali per game","params":{"burn_snake_turns":3,"uses_per_game":1}}'::jsonb,
    'Mematikan ancaman terbesar di papan, dan efeknya juga menguntungkan pemain lain yang lewat.',
    'Naga obsidian dengan sisik merah tua, retakan lava di dada, tanduk gading, sayap lebar, ekor berujung api.',
    array['bernapas','leher bergoyang','sayap mengepak','ekor bergelombang','rahang terbuka menyemburkan api tiap beberapa detik'],
    'Bara api naik, semburan api dari mulut.',
    array['raungan','semburan api','kepakan sayap'],
    array['#1b0a10','#a0182c','#ff7a18','#ffd24a'],
    '#ff4a3a',
    'Naga obsidian dengan retakan lava di dada. Setiap beberapa detik rahangnya terbuka dan menyemburkan api.',
    'coin', 10000000
  ),
  (
    'celestial_kitsune', 7, 'Divine', 'Celestial Kitsune', 'Divine Crystal dan Gold', 'Celestial Guardian', 'Pengubah Takdir',
    '{"name":"Sembilan Ekor","type":"active","effect":"Membuat tangga bayangan dari posisimu ke kotak mana pun dalam 9 kotak di depan.","limit":"1 kali per game","params":{"shadow_ladder_range":9,"uses_per_game":1}}'::jsonb,
    'Lompatan terbesar dan bisa dipakai kapan saja, termasuk untuk melewati ular.',
    'Rubah putih dan emas yang melayang di atas lingkaran sihir. Sembilan ekor tebal mengembang seperti kipas, ujungnya bintang bercahaya.',
    array['melayang naik turun','sembilan ekor bergelombang','telinga bergerak','bintang mengorbit','api roh biru melayang'],
    'Bintang putih, emas, dan biru naik ke atas.',
    array['lonceng arpeggio','lengkingan rubah','kilau'],
    array['#fdfbf4','#ffcf4a','#6ae8ff'],
    '#ffe08a',
    'Rubah sembilan ekor melayang di atas lingkaran sihir. Ekornya besar, berbulu tebal, mengembang seperti kipas dan berujung bintang.',
    'emerald', 3000
  )
on conflict (id) do update set
  tier = excluded.tier,
  tier_name = excluded.tier_name,
  name = excluded.name,
  material = excluded.material,
  identity = excluded.identity,
  role = excluded.role,
  skill = excluded.skill,
  advantage = excluded.advantage,
  visual = excluded.visual,
  animations = excluded.animations,
  effects = excluded.effects,
  sounds = excluded.sounds,
  palette = excluded.palette,
  accent_color = excluded.accent_color,
  lore = excluded.lore,
  price_currency = excluded.price_currency,
  price_amount = excluded.price_amount,
  updated_at = now();
