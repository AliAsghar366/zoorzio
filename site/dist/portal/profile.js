// Zoorzio Profile — backed by /auth/me, /users/me and /billing/subscription.

document.addEventListener('DOMContentLoaded', () => {
  const P = window.Portal;
  if (!P || !P.authed) return;

  const $ = (id) => document.getElementById(id);
  const LANGUAGES = { en: 'English (US)', es: 'Español', fr: 'Français', pt: 'Português' };

  function setText(id, value) {
    const el = $(id);
    if (el && value) el.textContent = value;
  }

  // ---- Load the signed-in user -------------------------------------------
  function renderUser(user) {
    if (!user) return;
    setText('emailValue', user.email);
    setText('phoneValue', user.phone || 'Not set');
    setText('languageValue', LANGUAGES[user.language] || user.language || 'English (US)');
    if (user.createdAt) {
      const d = new Date(user.createdAt);
      if (!isNaN(d)) {
        setText('memberSince', 'Member since ' + d.toLocaleDateString(undefined, {
          year: 'numeric', month: 'long', day: 'numeric',
        }));
      }
    }
  }

  renderUser(P.api.getUser());
  P.load('/auth/me', renderUser, 'Could not load your profile').catch(() => {});

  // ---- Subscription -------------------------------------------------------
  P.api.request('/billing/subscription')
    .then((sub) => {
      if (!sub) return;
      const plan = sub.plan || {};
      if (plan.name) setText('planName', plan.name);
      if (sub.status) {
        setText('planInterval', sub.status === 'ACTIVE' ? 'Active plan' : String(sub.status).toLowerCase());
      }
      const end = sub.currentPeriodEnd || sub.expiresAt;
      const d = end ? new Date(end) : null;
      setText('billingDate', d && !isNaN(d)
        ? 'Next billing date: ' + d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : 'No renewal scheduled');
    })
    .catch(() => { setText('billingDate', 'Subscription details unavailable'); });

  // ---- Editable fields ----------------------------------------------------
  function saveField(field, value, targetId, display) {
    return P.api.request('/users/me', { method: 'PUT', body: { [field]: value } })
      .then((user) => {
        setText(targetId, display ? display(value) : value);
        if (user) P.api.setSession({ user: user });
        P.notify('Saved.');
      })
      .catch((err) => P.notify(err.message, 'error'));
  }

  const phoneBtn = document.querySelector('.pf-change-btn[data-target="phoneValue"]');
  if (phoneBtn) {
    phoneBtn.addEventListener('click', () => {
      const current = ($('phoneValue') || {}).textContent || '';
      const next = window.prompt('Enter a new phone number', current.trim() === 'Not set' ? '' : current.trim());
      if (next && next.trim()) saveField('phone', next.trim(), 'phoneValue');
    });
  }

  const langBtn = document.querySelector('.pf-change-btn[data-target="languageValue"]');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      const code = window.prompt('Language code — one of: ' + Object.keys(LANGUAGES).join(', '), 'en');
      if (!code) return;
      const key = code.trim().toLowerCase();
      if (!LANGUAGES[key]) { P.notify('Unsupported language code: ' + key, 'error'); return; }
      saveField('language', key, 'languageValue', (v) => LANGUAGES[v]);
    });
  }

  // Any other prompt-driven rows that have no backend field stay local-only,
  // and say so rather than pretending the change was saved.
  document.querySelectorAll('.pf-change-btn[data-target]').forEach((btn) => {
    const t = btn.dataset.target;
    if (t === 'phoneValue' || t === 'languageValue') return;
    btn.addEventListener('click', () => {
      P.notify('This setting isn’t stored on your account yet.');
    });
  });

  // ---- Password -----------------------------------------------------------
  const passwordBtn = $('passwordBtn');
  if (passwordBtn) {
    passwordBtn.addEventListener('click', () => {
      const current = window.prompt('Enter your current password');
      if (!current) return;
      const next = window.prompt('Enter a new password (at least 8 characters)');
      if (!next) return;
      if (next.length < 8) { P.notify('New password must be at least 8 characters.', 'error'); return; }

      P.api.request('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      })
        .then(() => {
          // Changing the password drops every session, including this one.
          P.notify('Password updated — signing you back in.');
          P.api.clearSession();
          window.setTimeout(() => window.location.replace('/login/'), 1200);
        })
        .catch((err) => P.notify(err.message, 'error'));
    });
  }

  // ---- Danger zone toggle (presentation only) -----------------------------
  const dangerToggle = $('dangerToggle');
  const dangerPanel = $('dangerPanel');
  if (dangerToggle && dangerPanel) {
    dangerToggle.addEventListener('click', () => {
      const isOpen = dangerPanel.classList.toggle('is-open');
      dangerToggle.classList.toggle('is-open', isOpen);
      dangerToggle.setAttribute('aria-expanded', String(isOpen));
      dangerToggle.lastChild.textContent = isOpen ? ' Hide cancellation options' : ' Show cancellation options';
    });
  }

  // Sign-out is wired centrally in portal-session.js.
});
