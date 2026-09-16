// Zoorzio Workspace — sidebar view switching + calendar grid

document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.ws-nav__item');
  const views = document.querySelectorAll('.ws-view');

  function activateView(target) {
    if (!target) return;
    const matchingNavItems = document.querySelectorAll(`.ws-nav__item[data-view="${target}"]`);
    if (!matchingNavItems.length) return;

    navItems.forEach((el) => el.classList.remove('is-active'));
    matchingNavItems.forEach((el) => el.classList.add('is-active'));

    views.forEach((view) => {
      view.classList.toggle('is-active', view.dataset.viewPanel === target);
    });
  }

  navItems.forEach((item) => {
    item.addEventListener('click', () => activateView(item.dataset.view));
  });

  // Deep link: workspace.html#friends opens the Friends view directly
  const hashTarget = window.location.hash.replace('#', '');
  if (hashTarget) activateView(hashTarget);

  // Tab groups: toggle is-active within each .ws-tabs cluster
  document.querySelectorAll('.ws-tabs').forEach((group) => {
    group.addEventListener('click', (e) => {
      const tab = e.target.closest('.ws-tab');
      if (!tab) return;
      group.querySelectorAll('.ws-tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
    });
  });

  // Build the August 2026 calendar grid (matches the reference month)
  const grid = document.getElementById('calendarGrid');
  if (grid) {
    const daysInMonth = 31;
    const firstWeekday = 5; // Aug 1, 2026 is a Saturday (0 = Monday)
    const prevMonthDays = 31; // July 2026
    const todayDate = 28;

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ day: prevMonthDays - firstWeekday + 1 + i, muted: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, muted: false, today: d === todayDate });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: cells.length - (firstWeekday + daysInMonth) + 1, muted: true });
    }

    grid.innerHTML = cells.map((c) => {
      const cls = ['ws-calendar-day'];
      if (c.muted) cls.push('is-muted');
      if (c.today) cls.push('is-today');
      return `<div class="${cls.join(' ')}">${c.day}</div>`;
    }).join('');
  }

  // ---------- Lists: create new list ----------
  const listGrid = document.getElementById('listGrid');
  const listsSearch = document.getElementById('listsSearch');

  function addList(name) {
    if (!listGrid) return;
    const card = document.createElement('div');
    card.className = 'ws-list-card';
    card.innerHTML = `<h4>${name}</h4><p>0 items · just now</p>`;
    listGrid.appendChild(card);
  }

  ['createListBtn', 'createListBtnEmpty'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const name = window.prompt("Name your new list:", "My list");
      if (name && name.trim()) addList(name.trim());
    });
  });

  if (listsSearch && listGrid) {
    listsSearch.addEventListener('input', () => {
      const q = listsSearch.value.trim().toLowerCase();
      listGrid.querySelectorAll('.ws-list-card').forEach((card) => {
        const match = card.querySelector('h4').textContent.toLowerCase().includes(q);
        card.style.display = match ? '' : 'none';
      });
    });
  }

  const listsGridBtn = document.getElementById('listsGridBtn');
  const listsListBtn = document.getElementById('listsListBtn');
  if (listsGridBtn && listsListBtn && listGrid) {
    listsGridBtn.addEventListener('click', () => {
      listsGridBtn.classList.add('is-active');
      listsListBtn.classList.remove('is-active');
      listGrid.classList.remove('ws-list-grid--rows');
    });
    listsListBtn.addEventListener('click', () => {
      listsListBtn.classList.add('is-active');
      listsGridBtn.classList.remove('is-active');
      listGrid.classList.add('ws-list-grid--rows');
    });
  }

  // ---------- Tasks: create new board ----------
  const createBoardBtn = document.getElementById('createBoardBtn');
  if (createBoardBtn) {
    createBoardBtn.addEventListener('click', () => {
      const name = window.prompt('Name your new board:', 'New board');
      if (!name || !name.trim()) return;
      const board = document.createElement('article');
      board.className = 'ws-board';
      board.innerHTML = `
        <header class="ws-board__head">
          <span class="ws-board__avatar">Z</span>
          <span>${name.trim()}</span>
        </header>
        <ul class="ws-board__tasks"><li><span>No tasks yet</span></li></ul>`;
      createBoardBtn.parentElement.insertBefore(board, createBoardBtn);
    });
  }

  // ---------- Master Zoorzio: category detail ----------
  const masterCards = document.querySelectorAll('.ws-master-card');
  const masterDetail = document.getElementById('masterDetail');
  const masterContent = {
    actions: {
      title: 'Actions',
      body: 'Hands-on walkthroughs that teach Zoorzio by doing — 0 of 21 completed.',
      items: ['Set your first reminder', 'Connect a calendar', 'Create a list from chat'],
    },
    tricks: {
      title: 'Tricks',
      body: 'Small shortcuts that save you real time every day.',
      items: ['Voice-add a task in one sentence', 'Snooze a reminder by talking', 'Bulk-schedule your week'],
    },
    cases: {
      title: 'Use Cases',
      body: 'Ready-to-use prompts for daily life — just tap to try one.',
      items: ['"Plan my morning"', '"Summarize today\'s tasks"', '"Remind my friend about the trip"'],
    },
  };

  masterCards.forEach((card) => {
    card.addEventListener('click', () => {
      masterCards.forEach((c) => c.classList.remove('is-selected'));
      card.classList.add('is-selected');
      const data = masterContent[card.dataset.master];
      if (data && masterDetail) {
        masterDetail.innerHTML = `<strong>${data.title}</strong><p style="margin:8px 0 0;">${data.body}</p><ul>${data.items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
      }
    });
  });

  // ---------- Personality: tone + option cards ----------
  const personalityCard = document.getElementById('personalityCard');
  const dressCard = document.getElementById('dressCard');
  const chips = document.querySelectorAll('.ws-chip-select');
  const toneLabel = document.getElementById('toneLabel');

  if (personalityCard && dressCard) {
    personalityCard.addEventListener('click', (e) => {
      if (e.target.closest('.ws-chip-select')) return;
      personalityCard.classList.add('is-active');
      dressCard.classList.remove('is-active');
    });
    dressCard.addEventListener('click', () => {
      dressCard.classList.add('is-active');
      personalityCard.classList.remove('is-active');
    });
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      chips.forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      if (toneLabel) toneLabel.textContent = chip.dataset.tone;
    });
  });
});
