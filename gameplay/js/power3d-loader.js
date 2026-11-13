
/* Power 3D (assets/js/power3d): efek model+aura+partikel di atas pion + suara Power. Dimuat saat idle; gagal -> efek 2D (UT.PowerFX) tetap jalan. */
const go=()=>import('../../assets/js/power3d/power-overlay.js').then(m=>{ window.UT=window.UT||{}; UT.PowerOverlay=m; UT.PowerSound=m.PowerSound; }).catch(e=>console.warn('[power3d] tidak tersedia, efek 2D dipakai',e));
(window.requestIdleCallback||function(f){ setTimeout(f,1500); })(go);
