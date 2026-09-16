/* Backend wiring for the workspace.
 *
 * Each panel is filled from its own endpoint. A panel whose request fails
 * says so in place, rather than leaving the sample markup on screen looking
 * like real data. Loaded after workspace.js, which owns the view switching.
 */
document.addEventListener('DOMContentLoaded', function () {
  var P = window.Portal;
  if (!P || !P.authed) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }

  function panel(name) {
    return document.querySelector('[data-view-panel="' + name + '"]');
  }

  function fmtDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    var sameDay = d.toDateString() === new Date().toDateString();
    var time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    var day = sameDay ? 'Today' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return day + ' · ' + time;
  }

  // ---- Greeting -----------------------------------------------------------
  var eyebrow = document.querySelector('.ws-hero__eyebrow');
  var cached = P.api.getUser();
  if (eyebrow && cached) eyebrow.textContent = 'Welcome back, ' + P.firstName(cached);
  P.api.me().then(function (u) {
    if (eyebrow && u) eyebrow.textContent = 'Welcome back, ' + P.firstName(u);
  }).catch(function () {});

  // ---- Daily briefing -----------------------------------------------------
  var briefingText = document.querySelector('.ws-briefing__text');
  if (briefingText) {
    P.api.request('/briefing')
      .then(function (b) {
        if (!b) return;
        var summary = b.summary || b.text || b.message || (typeof b === 'string' ? b : '');
        if (summary) {
          var target = briefingText.querySelector('p') || briefingText;
          target.textContent = summary;
        }
      })
      .catch(function () { /* leave the written copy in place */ });
  }

  // ---- Tasks --------------------------------------------------------------
  var boardGrid = document.querySelector('.ws-board-grid');
  if (boardGrid) {
    P.api.request('/tasks')
      .then(function (tasks) {
        tasks = Array.isArray(tasks) ? tasks : [];
        boardGrid.innerHTML = '';
        if (!tasks.length) {
          boardGrid.appendChild(el('p', 'ws-section-label', 'No tasks yet.'));
          return;
        }

        var order = ['In progress', 'To do', 'Done'];
        var groups = { 'In progress': [], 'To do': [], 'Done': [] };
        tasks.forEach(function (t) {
          var s = String(t.status || '').toUpperCase();
          if (s === 'COMPLETED' || s === 'DONE') groups['Done'].push(t);
          else if (s === 'IN_PROGRESS') groups['In progress'].push(t);
          else groups['To do'].push(t);
        });

        order.forEach(function (label) {
          var items = groups[label];
          if (!items.length) return;

          var art = el('article', 'ws-board');
          var head = el('header', 'ws-board__head');
          head.appendChild(el('span', 'ws-board__avatar', 'Z'));
          head.appendChild(el('span', null, label));
          art.appendChild(head);

          var ul = el('ul', 'ws-board__tasks');
          items.slice(0, 8).forEach(function (t) {
            var li = document.createElement('li');
            li.appendChild(el('span', null, t.title || 'Untitled task'));
            var meta = el('span', 'ws-board__meta');
            var pr = String(t.priority || 'MEDIUM').toLowerCase();
            var cls = (pr === 'urgent' || pr === 'high') ? 'high' : (pr === 'low' ? 'low' : 'medium');
            meta.appendChild(el('em', 'ws-priority ws-priority--' + cls,
              pr.charAt(0).toUpperCase() + pr.slice(1)));
            li.appendChild(meta);
            ul.appendChild(li);
          });
          art.appendChild(ul);
          boardGrid.appendChild(art);
        });
      })
      .catch(function (err) {
        boardGrid.innerHTML = '';
        boardGrid.appendChild(el('p', 'ws-section-label', 'Could not load tasks: ' + err.message));
      });
  }

  // ---- Reminders ----------------------------------------------------------
  var remindersPanel = panel('reminders');
  if (remindersPanel) {
    P.api.request('/reminders')
      .then(function (items) {
        items = Array.isArray(items) ? items : [];
        var existing = remindersPanel.querySelectorAll('.ws-reminder-item');
        var parent = existing.length ? existing[0].parentNode : remindersPanel;
        Array.prototype.forEach.call(existing, function (n) { n.remove(); });

        if (!items.length) {
          parent.appendChild(el('p', 'ws-section-label', 'No reminders scheduled.'));
          return;
        }

        items.slice(0, 20).forEach(function (r) {
          var row = el('div', 'ws-reminder-item');
          row.appendChild(el('span', 'ws-reminder-item__dot'));
          var body = el('span', 'ws-reminder-item__body');
          body.appendChild(el('span', 'ws-reminder-item__title', r.title || r.message || 'Reminder'));
          var bits = [fmtDate(r.remindAt || r.scheduledAt || r.dueDate)];
          if (r.status) bits.push(String(r.status).toLowerCase());
          if (r.recurrence) bits.push(String(r.recurrence).toLowerCase());
          body.appendChild(el('span', 'ws-reminder-item__meta', bits.filter(Boolean).join(' · ')));
          row.appendChild(body);
          parent.appendChild(row);
        });
      })
      .catch(function (err) {
        remindersPanel.appendChild(el('p', 'ws-section-label',
          'Could not load reminders: ' + err.message));
      });
  }

  // ---- Lists --------------------------------------------------------------
  var listGrid = document.getElementById('listGrid');
  if (listGrid) {
    var renderList = function (l) {
      var card = el('div', 'ws-list-card');
      card.appendChild(el('h4', null, l.name || 'Untitled list'));
      var count = (l.items && l.items.length) || (l._count && l._count.items) || 0;
      card.appendChild(el('p', null, count + (count === 1 ? ' item' : ' items')));
      if (l.id) card.dataset.listId = l.id;
      return card;
    };

    P.api.request('/lists')
      .then(function (lists) {
        lists = Array.isArray(lists) ? lists : [];
        listGrid.innerHTML = '';
        if (!lists.length) {
          listGrid.appendChild(el('p', 'ws-section-label', 'No lists yet.'));
          return;
        }
        lists.forEach(function (l) { listGrid.appendChild(renderList(l)); });
      })
      .catch(function (err) {
        listGrid.innerHTML = '';
        listGrid.appendChild(el('p', 'ws-section-label', 'Could not load lists: ' + err.message));
      });

    // Swap the local-only create buttons for ones that actually persist.
    ['createListBtn', 'createListBtnEmpty'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      var fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', function () {
        var name = window.prompt('Name your new list:', 'My list');
        if (!name || !name.trim()) return;
        P.api.request('/lists', { method: 'POST', body: { name: name.trim() } })
          .then(function (created) {
            var placeholder = listGrid.querySelector('.ws-section-label');
            if (placeholder) placeholder.remove();
            listGrid.appendChild(renderList(created || { name: name.trim() }));
            P.notify('List created.');
          })
          .catch(function (err) { P.notify(err.message, 'error'); });
      });
    });
  }

  // ---- Friends ------------------------------------------------------------
  var friendsPanel = panel('friends');
  if (friendsPanel) {
    P.api.request('/friends').catch(function (err) {
      friendsPanel.appendChild(el('p', 'ws-section-label',
        'Could not load friends: ' + err.message));
    });
  }
});
