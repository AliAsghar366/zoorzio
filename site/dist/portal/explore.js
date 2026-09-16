// Zoorzio Explore — tab switching + interactions

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.ex-tab');
  const views = document.querySelectorAll('.ex-view');
  const bg = document.getElementById('exBg');

  function activateTab(target) {
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === target));
    views.forEach((v) => v.classList.toggle('is-active', v.dataset.panel === target));
    if (bg) {
      bg.classList.toggle('is-bubbles', target === 'bubbles');
      bg.classList.toggle('is-cleanup', target === 'cleanup');
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  const hashTarget = window.location.hash.replace('#', '');
  if (['everything', 'bubbles', 'cleanup'].includes(hashTarget)) activateTab(hashTarget);

  // My bubbles: add a bubble
  const addBubbleBtn = document.getElementById('addBubbleBtn');
  const scene = document.querySelector('.ex-bubbles-scene');
  if (addBubbleBtn && scene) {
    addBubbleBtn.addEventListener('click', () => {
      const name = window.prompt('Name this bubble:', 'New friend');
      if (!name || !name.trim()) return;
      const bubble = document.createElement('div');
      bubble.className = 'ex-bubble ex-bubble--mini';
      bubble.style.left = `${20 + Math.random() * 60}%`;
      bubble.style.top = `${15 + Math.random() * 50}%`;
      bubble.style.bottom = 'auto';
      bubble.innerHTML = `<span class="ex-bubble__tag">${name.trim()}</span>`;
      scene.appendChild(bubble);
    });
  }

  // Clean up: forget / keep flow
  const reviewBody = document.getElementById('reviewBody');
  const reviewIndex = document.getElementById('reviewIndex');
  const memLeft = document.getElementById('memLeft');
  const memReviewed = document.getElementById('memReviewed');
  const forgetBtn = document.getElementById('forgetBtn');
  const keepBtn = document.getElementById('keepBtn');

  const memories = [
    'My Zoorzio highlights reel',
    '"Slow mornings, warm drinks, and a little bit of Zoorzio magic."',
    'New gadget idea',
    'Team sync notes',
    'Zoorzio Portal screenshot',
    'Weekend trip planning notes',
    'Voice memo from Tuesday',
    'Recipe: matcha at home',
  ];
  let index = 0;

  function renderMemory() {
    if (!reviewBody) return;
    if (index >= memories.length) {
      reviewBody.textContent = "You're all caught up!";
      if (reviewIndex) reviewIndex.textContent = memories.length;
      if (forgetBtn) forgetBtn.disabled = true;
      if (keepBtn) keepBtn.disabled = true;
      return;
    }
    reviewBody.textContent = memories[index];
    if (reviewIndex) reviewIndex.textContent = index + 1;
  }

  function advance() {
    index += 1;
    if (memLeft) memLeft.textContent = Math.max(memories.length - index, 0);
    if (memReviewed) memReviewed.textContent = index;
    renderMemory();
  }

  if (forgetBtn) forgetBtn.addEventListener('click', advance);
  if (keepBtn) keepBtn.addEventListener('click', advance);
});
