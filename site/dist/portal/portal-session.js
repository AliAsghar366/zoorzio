/* Shared portal bootstrap: configure the API client, keep unauthenticated
 * visitors out, and give every page the same helpers for rendering the
 * signed-in user and reporting failures. Loaded before each page's own script.
 */
(function (window, document) {
  'use strict';

  var API = window.ZoorzioAPI.configure(window.ZOORZIO_API_URL || '');

  // No token -> the panel has nothing to show. Send them to sign in.
  var authed = API.requireAuth();

  function greetingFor(date) {
    var h = date.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function firstName(user) {
    if (!user) return 'there';
    var n = (user.name || '').trim();
    if (n) return n.split(/\s+/)[0];
    return (user.email || 'there').split('@')[0];
  }

  /* Non-blocking inline banner - the portal has no toast system and a failed
   * background fetch should never replace the page with an error screen. */
  function notify(message, kind) {
    var el = document.getElementById('portalNotice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'portalNotice';
      el.setAttribute('role', 'status');
      el.style.cssText =
        'position:fixed;left:50%;transform:translateX(-50%);bottom:24px;z-index:9999;' +
        'max-width:min(90vw,460px);padding:11px 16px;border-radius:12px;font:500 13px/1.45 ' +
        'system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;backdrop-filter:blur(12px);' +
        '-webkit-backdrop-filter:blur(12px);box-shadow:0 10px 30px rgba(20,12,35,.35);' +
        'transition:opacity .25s;opacity:0;';
      document.body.appendChild(el);
    }
    el.style.background = kind === 'error'
      ? 'rgba(150,40,60,.92)'
      : 'rgba(60,40,95,.92)';
    el.textContent = message;
    el.style.opacity = '1';
    window.clearTimeout(el._t);
    el._t = window.setTimeout(function () { el.style.opacity = '0'; }, 4200);
  }

  /* A page asks for what it needs; if the session is gone we bounce to login
   * rather than leaving placeholder content on screen pretending to be real. */
  function load(path, onData, label) {
    return API.request(path)
      .then(onData)
      .catch(function (err) {
        if (err.status === 401) {
          API.clearSession();
          window.location.replace('/login/');
          return;
        }
        notify((label || 'Could not load data') + ': ' + err.message, 'error');
        throw err;
      });
  }

  function signOut() {
    return API.logout().then(function () { window.location.replace('/login/'); });
  }

  // Wire any sign-out control on the page, wherever it lives.
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('signOutBtn');
    if (btn) {
      var fresh = btn.cloneNode(true); // drop the mock handler from profile.js
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', function () {
        if (window.confirm('Sign out of Zoorzio on this device?')) signOut();
      });
    }
  });

  window.Portal = {
    api: API,
    authed: authed,
    load: load,
    notify: notify,
    signOut: signOut,
    greetingFor: greetingFor,
    firstName: firstName,
    me: function () { return API.me(); },
  };
})(window, document);
