/* Daftar karakter (hero) — dipakai karakter.html dan gameplay.js. Pilihan disimpan di localStorage 'dragonroll:pref:hero'. */
const HEROES=[
 {id:'pemanah',name:'Shuri',cls:'Pemanah',icon:'ikon-kelas-pemanah.webp',art:'assets/komponen/karakter-monster/hero-shuri-pemanah.webp',desc:'Pemanah lincah dari hutan kabut. Tembakannya tak pernah meleset.',stat:[3,5,4]},
 {id:'pejuang',name:'Arga',cls:'Pejuang Terpilih',icon:'ikon-kelas-pejuang-terpilih.webp',desc:'Pejuang yang dipilih oleh naga kuno untuk menjaga papan.',stat:[5,3,4]},
 {id:'paladin',name:'Lumen',cls:'Paladin',icon:'ikon-kelas-paladin.webp',desc:'Ksatria suci dengan perisai cahaya.',stat:[4,2,5]},
 {id:'gladiator',name:'Brakk',cls:'Gladiator',icon:'ikon-kelas-gladiator.webp',desc:'Petarung arena yang tak kenal mundur.',stat:[5,2,4]},
 {id:'assassin',name:'Nyx',cls:'Assassin',icon:'ikon-kelas-assassin.webp',desc:'Bergerak dalam bayangan, menyerang tanpa suara.',stat:[4,5,2]},
 {id:'ranger',name:'Fenn',cls:'Ranger',icon:'ikon-kelas-ranger.webp',desc:'Penjelajah yang hafal setiap jalan pintas.',stat:[3,5,3]},
 {id:'penyihir',name:'Mira',cls:'Penyihir',icon:'ikon-kelas-penyihir.webp',desc:'Meramu mantra dari bintang malam.',stat:[4,3,3]},
 {id:'ahli-sihir',name:'Orlan',cls:'Ahli Sihir',icon:'ikon-kelas-ahli-sihir.webp',desc:'Tua, bijak, dan penuh trik.',stat:[5,2,3]},
 {id:'gelap',name:'Vexa',cls:'Penyihir Gelap',icon:'ikon-kelas-penyihir-gelap.webp',desc:'Kekuatan terlarang dengan harga yang mahal.',stat:[5,3,2]},
 {id:'pendeta',name:'Sora',cls:'Pendeta',icon:'ikon-kelas-pendeta.webp',desc:'Penyembuh yang menjaga seluruh tim.',stat:[2,3,5]}
];
const heroIcon=h=>'assets/komponen/ikon-kelas-hero/'+h.icon;
function getHero(){let id='pemanah';try{id=localStorage.getItem('dragonroll:pref:hero')||id}catch(e){}return HEROES.find(h=>h.id===id)||HEROES[0]}
function setHero(id){try{localStorage.setItem('dragonroll:pref:hero',id)}catch(e){}}
