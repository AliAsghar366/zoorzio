// Zoorzio Portal — micro-interactions

document.addEventListener('DOMContentLoaded', () => {
  const bg = document.getElementById('portalBg');
  const nav = document.querySelector('.bottom-nav');
  const closeBtn = document.querySelector('.discovery-card__close');
  const discoveryCard = document.getElementById('discoveryCard');

  // Subtle parallax on the candy bar background
  if (bg && window.matchMedia('(hover: hover)').matches) {
    const strength = 10;
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * strength;
      const y = (e.clientY / window.innerHeight - 0.5) * strength;
      bg.style.transform = `scale(1.05) translate(${x}px, ${y}px)`;
    });
  }

  // Bottom nav tab switching
  if (nav) {
    nav.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (!item || item.id === 'moreBtn') return;
      nav.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('is-active'));
      item.classList.add('is-active');
    });
  }

  // Dismiss discovery card
  if (closeBtn && discoveryCard) {
    closeBtn.addEventListener('click', () => {
      discoveryCard.classList.add('is-hidden');
    });
  }

  // "More" popover
  const moreBtn = document.getElementById('moreBtn');
  const morePanel = document.getElementById('morePanel');
  const moreOverlay = document.getElementById('moreOverlay');

  if (moreBtn && morePanel && moreOverlay) {
    const openMore = () => {
      morePanel.classList.add('is-open');
      moreOverlay.classList.add('is-open');
      morePanel.setAttribute('aria-hidden', 'false');
      moreBtn.setAttribute('aria-expanded', 'true');
    };
    const closeMore = () => {
      morePanel.classList.remove('is-open');
      moreOverlay.classList.remove('is-open');
      morePanel.setAttribute('aria-hidden', 'true');
      moreBtn.setAttribute('aria-expanded', 'false');
    };

    moreBtn.addEventListener('click', () => {
      const isOpen = morePanel.classList.contains('is-open');
      isOpen ? closeMore() : openMore();
    });
    moreOverlay.addEventListener('click', closeMore);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMore();
    });
  }
});

/* ---------------------------------------------------------------------------
 * Backend wiring for the portal home.
 * Greeting comes from the signed-in user; the ask box posts to /chat and
 * hands the conversation over to the Coffee page.
 * ------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  if (!window.Portal || !window.Portal.authed) return;
  var P = window.Portal;

  var greetingEl = document.getElementById('heroGreeting');
  if (greetingEl) {
    var cached = P.api.getUser();
    if (cached) {
      greetingEl.textContent = P.greetingFor(new Date()) + ', ' + P.firstName(cached);
    }
    P.load('/auth/me', function (user) {
      if (!user) return;
      greetingEl.textContent = P.greetingFor(new Date()) + ', ' + P.firstName(user);
    }, 'Could not load your profile').catch(function () {});
  }

  var ask = document.getElementById('heroAsk');
  if (ask) {
    var go = function () {
      var text = ask.value.trim();
      if (!text) { ask.focus(); return; }
      // Coffee is the conversation surface - send it there and let that page
      // own the exchange, rather than half-rendering a reply on the home hero.
      try { sessionStorage.setItem('zoorzio_pending_message', text); } catch (err) {}
      window.location.href = 'coffee.html';
    };
    ask.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      go();
    });
    var sendBtn = document.getElementById('heroSend');
    if (sendBtn) sendBtn.addEventListener('click', go);
  }
});
