/* Shared head assets for non-gameplay pages. */
window.UT = window.UT || {};

(function (win, doc) {
  'use strict';

  var UT = win.UT;
  UT.PageShell = UT.PageShell || {};

  function normalizeItems(items) {
    return (items || []).map(function (item) {
      if (!item) return null;
      if (typeof item === 'string') return { href: item, src: item };
      if (item && typeof item === 'object') return {
        href: item.href || item.src || item.url || '',
        src: item.src || item.href || item.url || '',
        attrs: item.attrs || {}
      };
      return null;
    }).filter(Boolean);
  }

  function dedupe(items) {
    var seen = Object.create(null), out = [];
    normalizeItems(items).forEach(function (item) {
      var key = item.src || item.href;
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(item);
    });
    return out;
  }

  UT.PageShell.FONT_PRELOAD = ['assets/fonts/lilita-one-latin-400-normal.woff2', 'assets/fonts/nunito-latin-600-normal.woff2', 'assets/fonts/nunito-latin-800-normal.woff2'];

  UT.PageShell.writeTag = function (tagName, attrs, text) {
    var out = '<' + tagName;
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === null || value === undefined || value === false) return;
      if (value === true) { out += ' ' + key; return; }
      out += ' ' + key + '="' + String(value).replace(/"/g, '&quot;') + '"';
    });
    out += '>';
    if (text) out += text;
    if (tagName === 'script') out += '</script>';
    doc.write(out);
  };

  UT.PageShell.render = function (config) {
    config = config || {};
    var css = dedupe((config.sharedCss || []).concat(config.css || []));
    var js = dedupe((config.sharedJs || []).concat(config.js || []));

    css.forEach(function (item) {
      UT.PageShell.writeTag('link', Object.assign({ rel: 'stylesheet' }, item.attrs || {}, { href: item.href || item.src }));
    });

    js.forEach(function (item) {
      UT.PageShell.writeTag('script', Object.assign({}, item.attrs || {}, { src: item.src || item.href }));
    });
  };

  UT.PageShell.renderBase = function (options) {
    options = options || {};
    function enabled(name) { return options[name] !== false; }

    UT.PageShell.render({
      sharedJs: [
        enabled('frameGuard') ? 'assets/js/frame-guard.js' : null,
        enabled('session') ? 'assets/js/core/session.js' : null,
        enabled('bootGuard') ? 'assets/js/boot-guard.js' : null
      ]
    });
    /* Font utama dimuat paralel dengan CSS (preload), bukan baru ditemukan setelah fonts.css diurai -> teks tidak sempat tampil dengan font cadangan. */
    var preload = enabled('fonts') ? UT.PageShell.FONT_PRELOAD.map(function (href) {
      return { href: href, attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true } };
    }) : [];
    UT.PageShell.render({
      sharedCss: preload.concat([
        enabled('fonts') ? 'src/styles/fonts.css' : null,
        enabled('commonCss') ? 'src/styles/common.css' : null,
        enabled('skeleton') ? 'src/styles/components/skeleton.css' : null
      ])
    });
    UT.PageShell.render({
      sharedJs: [
        enabled('prefs') ? 'assets/js/core/prefs.js' : null,
        enabled('prefsSync') ? 'assets/js/core/prefs-sync.js' : null,
        enabled('skeleton') ? 'assets/js/systems/skeleton.js' : null
      ]
    });
  };
})(window, document);
