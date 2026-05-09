// Popup logic — same supported-URL filter as the content script.
// Reads the active tab via the `activeTab` permission, falls back
// to a manual paste textarea when the tab isn't on a media page.

(function () {
  'use strict';

  // Cross-browser polyfill: Firefox exposes `browser`, Chromium
  // exposes `chrome` (with the same MV3 surface for the bits we use).
  const ext = typeof browser !== 'undefined' ? browser : chrome;

  function isSupported(href) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return false;
    }
    const host = url.hostname;
    const path = url.pathname;
    if (host.endsWith('youtube.com')) {
      return path === '/watch' && url.searchParams.has('v');
    }
    if (host === 'soundcloud.com') {
      const segs = path.split('/').filter(Boolean);
      if (segs.length !== 2) return false;
      const reserved = ['you', 'discover', 'search', 'pages', 'stations', 'mobile'];
      if (reserved.includes(segs[0])) return false;
      if (['sets', 'tracks', 'albums', 'reposts', 'likes'].includes(segs[1])) return false;
      return true;
    }
    if (host.endsWith('.bandcamp.com')) {
      return /^\/(track|album)\//.test(path);
    }
    if (host === 'audiomack.com') {
      return /^\/[^/]+\/(song|album)\//.test(path);
    }
    if (host === 'archive.org') {
      return /^\/details\//.test(path);
    }
    return false;
  }

  const detected = document.getElementById('detected');
  const manual = document.getElementById('manual');
  const sendBtn = document.getElementById('send');

  let activeUrl = '';

  function fire(url) {
    if (!url) return;
    // Custom-protocol navigation: route through the OS handler that
    // the desktop installer / AppImage runtime registered.
    window.location.href = 'patotube://download?url=' + encodeURIComponent(url);
    // Tiny grace period so the OS gets the URL before we close.
    setTimeout(() => window.close(), 150);
  }

  function recompute() {
    const pasted = manual.value.trim();
    const target = pasted || activeUrl;
    sendBtn.disabled = !target || !isSupported(target);
  }

  manual.addEventListener('input', recompute);

  sendBtn.addEventListener('click', () => {
    const pasted = manual.value.trim();
    fire(pasted || activeUrl);
  });

  // Pull the current tab's URL via activeTab.
  ext.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) return;
      if (isSupported(tab.url)) {
        activeUrl = tab.url;
        detected.textContent = tab.url;
        detected.classList.remove('empty');
      }
      recompute();
    })
    .catch(() => {
      /* activeTab denied or popup opened from non-tab context — fall back to manual paste only */
    });
})();
