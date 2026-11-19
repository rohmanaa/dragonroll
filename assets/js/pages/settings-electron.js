/* Add-on khusus Electron; tidak mengubah settings.js yang sudah ada. */
(() => {
  'use strict';

  const buttons = [...document.querySelectorAll('[data-display]')];
  if (!buttons.length) return;

  const api = window.electronAPI;
  const toast = (message) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('on'), 1800);
  };

  const setActive = (isFullscreen) => {
    buttons.forEach((button) => {
      const active = (button.dataset.display === 'fullscreen') === isFullscreen;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  if (!api || typeof api.setFullscreen !== 'function' || typeof api.getFullscreen !== 'function') {
    buttons.forEach((button) => { button.disabled = true; });
    toast('Pengaturan tampilan hanya tersedia di aplikasi desktop.');
    return;
  }

  api.getFullscreen()
    .then(setActive)
    .catch(() => toast('Status tampilan tidak dapat dibaca.'));

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const fullscreen = button.dataset.display === 'fullscreen';
      buttons.forEach((item) => { item.disabled = true; });
      try {
        const actualState = await api.setFullscreen(fullscreen);
        setActive(Boolean(actualState));
      } catch (error) {
        console.error('[Dragon Roll] Gagal mengubah mode tampilan:', error);
        toast('Mode tampilan gagal diubah.');
      } finally {
        buttons.forEach((item) => { item.disabled = false; });
      }
    });
  });
})();
