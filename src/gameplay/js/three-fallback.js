
if (typeof THREE === 'undefined') {
  var overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = '#111';
  overlay.style.color = '#fff';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '99999';
  overlay.style.fontFamily = 'sans-serif';
  overlay.style.padding = '24px';
  overlay.style.textAlign = 'center';
  overlay.innerHTML = '<div style="font-size:20px;font-weight:bold;margin-bottom:12px;">Gagal memuat Three.js. Periksa koneksi internet lalu muat ulang.</div><button onclick="location.reload()" style="padding:10px 24px;font-size:16px;cursor:pointer;">Muat Ulang</button>';
  document.body.appendChild(overlay);
  window.__NO_THREE = true;
}
