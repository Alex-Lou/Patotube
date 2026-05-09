// Patotube content script — injects a "Send to Patotube" button on
// supported media pages. The button fires the patotube:// URL scheme,
// which the desktop app picks up and turns into a download preview.
//
// Kept intentionally close to the userscript twin
// (`landing/public/patotube.user.js`) so behaviour is identical
// across both delivery channels.

(function () {
  'use strict';

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

  const BTN_ID = 'patotube-extension-button';

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = '🦆 Send to Patotube';
    btn.title = 'Open this page in the Patotube desktop app';
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

  sync();

  // SPA navigation hook (YouTube etc.).
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
  window.addEventListener('popstate', sync);
  window.addEventListener('patotube:locationchange', sync);
})();
