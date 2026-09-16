/* Zoorzio portal <-> apps/api client.
 *
 * One place for: where the API lives, how tokens are stored, how the response
 * envelope is unwrapped, and what happens when a token expires. Every portal
 * page and the login page go through this.
 *
 * The API wraps every response as { success, data, message, ... }, so callers
 * here always receive the already-unwrapped `data`.
 */
(function (window) {
  'use strict';

  var ACCESS_KEY = 'zoorzio_access_token';
  var REFRESH_KEY = 'zoorzio_refresh_token';
  var USER_KEY = 'zoorzio_user';
  var PLACEHOLDER = 'REPLACE-WITH';

  var baseUrl = '';

  function isLocalHost() {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  }

  function store(key, value) {
    try {
      if (value === null || value === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) {/* private mode / blocked storage */}
  }

  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  var API = {
    /* Accepts the deploy-time placeholder. Falls back to the local API when
     * the page is served from localhost, so the portal is testable before
     * ZOORZIO_API_URL is configured on the deployment. */
    configure: function (url) {
      if (url && url.indexOf(PLACEHOLDER) === -1) baseUrl = url;
      else if (isLocalHost()) baseUrl = 'http://localhost:3005/api';
      else baseUrl = '';
      return API;
    },

    baseUrl: function () { return baseUrl; },
    isConfigured: function () { return !!baseUrl; },
    getToken: function () { return read(ACCESS_KEY); },
    getRefreshToken: function () { return read(REFRESH_KEY); },

    getUser: function () {
      var raw = read(USER_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return { name: raw }; }
    },

    setSession: function (data) {
      if (!data) return;
      store(ACCESS_KEY, data.accessToken || null);
      store(REFRESH_KEY, data.refreshToken || null);
      if (data.user) store(USER_KEY, JSON.stringify(data.user));
    },

    clearSession: function () {
      store(ACCESS_KEY, null);
      store(REFRESH_KEY, null);
      store(USER_KEY, null);
    },

    /* Core request. Unwraps the envelope, throws Error(message) on failure,
     * and transparently retries once after refreshing an expired token. */
    request: function (path, options) {
      options = options || {};
      if (!baseUrl) {
        return Promise.reject(new Error('The backend URL has not been configured for this deployment.'));
      }

      var headers = { 'Content-Type': 'application/json' };
      for (var h in (options.headers || {})) headers[h] = options.headers[h];
      var token = API.getToken();
      if (token && !options.anonymous) headers.Authorization = 'Bearer ' + token;

      var init = { method: options.method || 'GET', headers: headers };
      if (options.body !== undefined) init.body = JSON.stringify(options.body);

      return fetch(baseUrl + path, init).then(function (res) {
        return res.text().then(function (text) {
          var payload = null;
          try { payload = text ? JSON.parse(text) : null; } catch (e) {/* non-JSON */}

          if (res.status === 401 && !options._retried && API.getRefreshToken() && !options.anonymous) {
            return API.refresh().then(function () {
              options._retried = true;
              return API.request(path, options);
            });
          }

          if (!res.ok) {
            var msg = (payload && (payload.message || payload.error)) ||
                      ('Request failed (' + res.status + ')');
            var err = new Error(msg);
            err.status = res.status;
            throw err;
          }

          // Unwrap { success, data } -> data; pass anything else through.
          if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
            return payload.data;
          }
          return payload;
        });
      });
    },

    login: function (email, password) {
      return API.request('/auth/login', {
        method: 'POST',
        anonymous: true,
        body: { email: email, password: password },
      }).then(function (data) {
        if (!data || !data.accessToken) {
          throw new Error('Sign-in did not return a token. Please try again.');
        }
        API.setSession(data);
        return data;
      });
    },

    refresh: function () {
      var refreshToken = API.getRefreshToken();
      if (!refreshToken) return Promise.reject(new Error('Session expired.'));
      return API.request('/auth/refresh', {
        method: 'POST',
        anonymous: true,
        body: { refreshToken: refreshToken },
      }).then(function (data) {
        if (!data || !data.accessToken) throw new Error('Session expired.');
        API.setSession(data);
        return data;
      }).catch(function (err) {
        API.clearSession();
        throw err;
      });
    },

    logout: function () {
      var refreshToken = API.getRefreshToken();
      var done = refreshToken
        ? API.request('/auth/logout', { method: 'POST', body: { refreshToken: refreshToken } })
            .catch(function () { /* logging out locally matters more */ })
        : Promise.resolve();
      return done.then(function () { API.clearSession(); });
    },

    me: function () { return API.request('/auth/me'); },

    /* Portal pages call this first: no token means no panel. */
    requireAuth: function () {
      if (API.getToken()) return true;
      window.location.replace('/login/');
      return false;
    },
  };

  window.ZoorzioAPI = API;
})(window);
