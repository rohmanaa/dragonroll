(function () {
  'use strict';
  if (window.parent === window || new URLSearchParams(location.search).get('from') !== 'room') return;

  document.documentElement.classList.add('ut-room-embed');
  var style = document.createElement('style');
  style.textContent = 'html.ut-room-embed,html.ut-room-embed body,html.ut-room-embed #wrap{background:#4b4162!important}html.ut-room-embed body #stage{background:#483e60!important}';
  document.head.appendChild(style);

  document.addEventListener('click', function (event) {
    var back = event.target && event.target.closest && event.target.closest('#back, #home');
    if (!back) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.parent.postMessage({ type: 'ut-room-modal-close' }, '*');
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (document.querySelector('.modal.on, #md.on, .ov.show, #modal.show')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.parent.postMessage({ type: 'ut-room-modal-close' }, '*');
  }, true);
})();
