/* Gameplay Voxel Geometry (Stage 4.1.12) — HANYA geometri murni & deterministik: pemetaan tile serpentine 10x10, posisi dunia tile,
   tinggi terrain (gelombang), dan pembangun kotak voxel (FACES/CORNERS/EDGES, makeBatch, addBox, addOBox).
   Semua rumus dipindahkan APA ADANYA dari gameplay.html (tidak ada perubahan koordinat/ukuran/urutan/warna).
   Bukan pemilik scene/kamera/renderer: tidak membuat THREE.Scene/Camera/WebGLRenderer. Tanpa timer, async, event listener, Math.random, atau state gameplay.
   Satu-satunya dependensi Three.js: THREE.Color di addBox/addOBox, dibaca saat dipanggil (bukan saat load).
   Pawn, kamera, FX, Dragon, builder tangga/ular/peti/mob (menyentuh scene), dan state gameplay TETAP di gameplay.html.
   Classic script. Namespace: UT.GameplayVoxelGeom. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayVoxelGeom) return;

  /* tile 1..100 -> {row,col} (serpentine: baris genap kiri->kanan, ganjil kanan->kiri) dan kebalikannya */
  function tileToGrid(n) { var i = n - 1, row = Math.floor(i / 10), k = i % 10; return { row: row, col: (row % 2 === 0) ? k : 9 - k }; }
  function gridToTile(row, col) { return row * 10 + ((row % 2 === 0) ? col : 9 - col) + 1; }

  /* Daftar tile [null, {n,row,col,x,z,h}, ...]; x/z = posisi dunia, h = tinggi terrain (tile >= 99 = 1.0). */
  function buildTiles() {
    var TILES = [null];
    for (var n = 1; n <= 100; n++) {
      var g = tileToGrid(n), row = g.row, col = g.col;
      var wv = Math.round((Math.sin(col * 0.8 + row * 0.55) * 0.5 + 0.5) * 3) * 0.2;
      TILES.push({ n: n, row: row, col: col, x: col - 4.5, z: 4.5 - row, h: n >= 99 ? 1.0 : wv });
    }
    return TILES;
  }
  function terrainTop(TILES, x, z) {
    var col = Math.floor(x + 5), row = Math.round(4.5 - z);
    if (col < 0 || col > 9 || row < 0 || row > 9) return 0;
    return TILES[gridToTile(row, col)].h;
  }
  function topAt(TILES, x, z, r) {
    return Math.max(terrainTop(TILES, x, z), terrainTop(TILES, x + r, z), terrainTop(TILES, x - r, z), terrainTop(TILES, x, z + r), terrainTop(TILES, x, z - r));
  }

  /* ---- Pembangun kotak voxel (salinan persis dari blok GEOM-START..GEOM-END) ---- */
  const FACES=[
    {n:[1,0,0],v:[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]},
    {n:[-1,0,0],v:[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]},
    {n:[0,1,0],v:[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]},
    {n:[0,-1,0],v:[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]},
    {n:[0,0,1],v:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]},
    {n:[0,0,-1],v:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]}
  ];
  const CORNERS=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const EDGES=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  function makeBatch(){ return {pos:[],nor:[],col:[],idx:[],lpos:[],lcol:[],n:0}; }
  function addBox(b,cx,cy,cz,sx,sy,sz,color,o){
    o=o||{};
    const col=color&&color.isColor?color:new win.THREE.Color(color);
    const yaw=o.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
    const hx=sx/2,hy=sy/2,hz=sz/2;
    const tr=(x,y,z)=>[cx+x*c+z*s,cy+y,cz-x*s+z*c];
    for(let f=0;f<FACES.length;f++){
      const F=FACES[f],base=b.n;
      for(let k=0;k<4;k++){
        const v=F.v[k],p=tr(v[0]*hx,v[1]*hy,v[2]*hz);
        b.pos.push(p[0],p[1],p[2]);
        b.nor.push(F.n[0]*c+F.n[2]*s,F.n[1],-F.n[0]*s+F.n[2]*c);
        b.col.push(col.r,col.g,col.b);
      }
      b.idx.push(base,base+1,base+2,base,base+2,base+3);
      b.n+=4;
    }
    if(o.edge!==false){
      const k=o.edgeK||0.5,er=col.r*k,eg=col.g*k,eb=col.b*k;
      const pts=CORNERS.map(v=>tr(v[0]*hx,v[1]*hy,v[2]*hz));
      for(let e=0;e<EDGES.length;e++){
        const a=pts[EDGES[e][0]],d=pts[EDGES[e][1]];
        b.lpos.push(a[0],a[1],a[2],d[0],d[1],d[2]);
        b.lcol.push(er,eg,eb,er,eg,eb);
      }
    }
  }
  /* Kotak miring bebas arah: C pusat, U/V/W vektor setengah-sisi. Dipakai untuk tangga. */
  function addOBox(b,C,U,V,W,color){
    const col=color&&color.isColor?color:new win.THREE.Color(color);
    const det=U[0]*(V[1]*W[2]-V[2]*W[1])-U[1]*(V[0]*W[2]-V[2]*W[0])+U[2]*(V[0]*W[1]-V[1]*W[0]);
    const flip=det<0,ax=[U,V,W],cs=[[-1,-1],[1,-1],[1,1],[-1,1]];
    for(let a=0;a<3;a++){
      const A=ax[a],B=ax[(a+1)%3],D=ax[(a+2)%3],len=Math.hypot(A[0],A[1],A[2])||1;
      for(let sg=-1;sg<=1;sg+=2){
        const base=b.n,nx=sg*A[0]/len,ny=sg*A[1]/len,nz=sg*A[2]/len;
        for(let k=0;k<4;k++){
          const i=cs[k][0],j=cs[k][1];
          b.pos.push(C[0]+sg*A[0]+i*B[0]+j*D[0],C[1]+sg*A[1]+i*B[1]+j*D[1],C[2]+sg*A[2]+i*B[2]+j*D[2]);
          b.nor.push(nx,ny,nz); b.col.push(col.r,col.g,col.b);
        }
        if((sg<0)!==flip) b.idx.push(base,base+2,base+1,base,base+3,base+2);
        else b.idx.push(base,base+1,base+2,base,base+2,base+3);
        b.n+=4;
      }
    }
  }

  UT.GameplayVoxelGeom = {
    tileToGrid: tileToGrid, gridToTile: gridToTile, buildTiles: buildTiles, terrainTop: terrainTop, topAt: topAt,
    FACES: FACES, CORNERS: CORNERS, EDGES: EDGES, makeBatch: makeBatch, addBox: addBox, addOBox: addOBox
  };
})(window);
