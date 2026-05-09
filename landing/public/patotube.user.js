// ==UserScript==
// @name         Patotube — Send to desktop
// @namespace    https://alex-lou.github.io/Patotube/
// @version      0.4.0
// @description  Adds a "Send to Patotube" button on YouTube / SoundCloud / Bandcamp / Audiomack / Internet Archive media pages. Click it to fire patotube:// and let the desktop app pick the URL up.
// @author       Patotube
// @license      MIT
// @match        https://www.youtube.com/watch*
// @match        https://m.youtube.com/watch*
// @match        https://music.youtube.com/watch*
// @match        https://soundcloud.com/*/*
// @match        https://*.bandcamp.com/track/*
// @match        https://*.bandcamp.com/album/*
// @match        https://audiomack.com/*/song/*
// @match        https://audiomack.com/*/album/*
// @match        https://archive.org/details/*
// @icon         https://alex-lou.github.io/Patotube/patotube.png
// @grant        none
// @run-at       document-idle
// @updateURL    https://alex-lou.github.io/Patotube/patotube.user.js
// @downloadURL  https://alex-lou.github.io/Patotube/patotube.user.js
// @homepageURL  https://alex-lou.github.io/Patotube/
// @supportURL   https://github.com/Alex-Lou/Patotube/issues
// ==/UserScript==

(function () {
  'use strict';

  /**
   * Pages that match @match but are NOT single media items
   * (channel pages, set/playlist URLs, search results, …) are
   * filtered out so the button doesn't show on them. The desktop
   * kernels would reject them anyway.
   */
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

  const BTN_ID = 'patotube-userscript-button';

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = '🦆 Send to Patotube';
    btn.title = 'Open this page in the Patotube desktop app';
    // Hard-coded styles — we don't want to depend on host CSS.
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '2147483647',
      padding: '10px 14px',
      borderRadius: '24px',
      border: 'none',
      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      color: '#0a0a0a',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSize: '13px',
      fontWeight: '600',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
      cursor: 'pointer',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.32)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = encodeURIComponent(location.href);
      // Direct assignment instead of window.open: the latter triggers
      // a popup blocker prompt on some browsers, the former routes
      // cleanly to the registered protocol handler.
      window.location.href = 'patotube://download?url=' + target;
    });
    return btn;
  }

  function sync() {
    const present = document.getElementById(BTN_ID);
    const supported = isSupported(location.href);
    if (supported && !present && document.body) {
      document.body.appendChild(makeButton());
    } else if (!supported && present) {
      present.remove();
    }
  }

  // Initial paint.
  sync();

  // YouTube (and many modern sites) is an SPA — `pushState` /
  // `replaceState` change `location.href` without a navigation
  // event. Hook them and re-sync on every transition.
  const wrap = (kind) => {
    const orig = history[kind];
    history[kind] = function (...args) {
      const out = orig.apply(this, args);
      window.dispatchEvent(new Event('patotube:locationchange'));
      return out;
    };
  };
  wrap('pushState');
  wrap('replaceState');
  window.addEventListener('popstate', () => sync());
  window.addEventListener('patotube:locationchange', () => sync());
})();
