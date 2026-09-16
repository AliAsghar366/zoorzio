/* Create, edit and inspect from the workspace.
 *
 * workspace-data.js fills the panels from the API but is read-only: the only
 * thing it can create is a list, via a window.prompt. So tasks and reminders
 * could not be made from the UI at all, list cards showed a count with no way
 * to open them, and nothing could be completed or deleted. This adds those.
 *
 * It re-renders from the server after every write rather than patching the DOM
 * by hand, so what you see is what was actually saved.
 */
document.addEventListener('DOMContentLoaded', function () {
  var P = window.Portal;
  if (!P || !P.authed) return;
  var API = P.api;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }

  function panel(name) {
    return document.querySelector('[data-view-panel="' + name + '"]');
  }

  function fmt(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    var today = new Date();
    var sameDay = d.toDateString() === today.toDateString();
    var time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (sameDay) return 'Today ' + time;
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + time;
  }

  /** A datetime-local value is local wall-clock with no zone; the API wants ISO. */
  function toIso(localValue) {
    if (!localValue) return null;
    var d = new Date(localValue);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function busy(btn, on, label) {
    btn.disabled = on;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.textContent = label || 'Saving…';
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
  }

  // ======================================================== TASKS
  function mountTasks() {
    var p = panel('tasks');
    var grid = document.getElementById('boardGrid') || document.querySelector('.ws-board-grid');
    if (!p || !grid || p.querySelector('.wsx-composer')) return;

    var form = el('form', 'wsx-composer');
    form.innerHTML =
      '<input class="wsx-input" name="title" placeholder="What needs doing?" required maxlength="200" />' +
      '<select class="wsx-select" name="priority" aria-label="Priority">' +
      '  <option value="LOW">Low</option>' +
      '  <option value="MEDIUM" selected>Medium</option>' +
      '  <option value="HIGH">High</option>' +
      '  <option value="URGENT">Urgent</option>' +
      '</select>' +
      '<input class="wsx-input wsx-input--date" type="datetime-local" name="dueDate" aria-label="Due date" />' +
      '<button class="wsx-btn" type="submit">Add task</button>';

    var head = p.querySelector('.ws-page-head');
    if (head && head.nextSibling) head.parentNode.insertBefore(form, head.nextSibling);
    else p.insertBefore(form, p.firstChild);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button');
      var title = form.title.value.trim();
      if (!title) return;
      var body = { title: title, priority: form.priority.value };
      var due = toIso(form.dueDate.value);
      if (due) body.dueDate = due;

      busy(btn, true);
      API.request('/tasks', { method: 'POST', body: body })
        .then(function () {
          form.reset();
          P.notify('Task added.');
          return renderTasks();
        })
        .catch(function (err) { P.notify(err.message, 'error'); })
        .finally(function () { busy(btn, false); });
    });

    renderTasks();

    function renderTasks() {
      return API.request('/tasks').then(function (tasks) {
        tasks = Array.isArray(tasks) ? tasks : [];
        grid.innerHTML = '';
        if (!tasks.length) {
          grid.appendChild(el('p', 'ws-section-label', 'No tasks yet — add one above.'));
          return;
        }
        var groups = { 'In progress': [], 'To do': [], 'Done': [] };
        tasks.forEach(function (t) {
          var s = String(t.status || '').toUpperCase();
          if (s === 'COMPLETED' || s === 'DONE') groups['Done'].push(t);
          else if (s === 'IN_PROGRESS') groups['In progress'].push(t);
          else groups['To do'].push(t);
        });

        ['In progress', 'To do', 'Done'].forEach(function (label) {
          var items = groups[label];
          if (!items.length) return;
          var art = el('article', 'ws-board');
          var head = el('header', 'ws-board__head');
          head.appendChild(el('span', 'ws-board__avatar', 'Z'));
          head.appendChild(el('span', null, label + ' (' + items.length + ')'));
          art.appendChild(head);

          var ul = el('ul', 'ws-board__tasks');
          items.forEach(function (t) {
            var li = document.createElement('li');
            li.className = 'wsx-row';

            var main = el('span', 'wsx-row__main');
            main.appendChild(el('span', 'wsx-row__title', t.title || 'Untitled task'));

            // The detail people actually need: when it is due, and what it says.
            var bits = [];
            var pr = String(t.priority || 'MEDIUM').toLowerCase();
            bits.push(pr.charAt(0).toUpperCase() + pr.slice(1));
            if (t.dueDate) bits.push('due ' + fmt(t.dueDate));
            if (t.description) bits.push(t.description);
            main.appendChild(el('span', 'wsx-row__meta', bits.join(' · ')));
            li.appendChild(main);

            var actions = el('span', 'wsx-actions');
            var done = String(t.status || '').toUpperCase();
            if (done !== 'COMPLETED' && done !== 'DONE') {
              var ok = el('button', 'wsx-icon', '✓');
              ok.title = 'Mark complete';
              ok.addEventListener('click', function () {
                API.request('/tasks/' + t.id + '/complete', { method: 'PUT', body: {} })
                  .then(function () { P.notify('Task completed.'); return renderTasks(); })
                  .catch(function (err) { P.notify(err.message, 'error'); });
              });
              actions.appendChild(ok);
            }
            var del = el('button', 'wsx-icon wsx-icon--danger', '×');
            del.title = 'Delete';
            del.addEventListener('click', function () {
              if (!window.confirm('Delete "' + (t.title || 'this task') + '"?')) return;
              API.request('/tasks/' + t.id, { method: 'DELETE' })
                .then(function () { P.notify('Task deleted.'); return renderTasks(); })
                .catch(function (err) { P.notify(err.message, 'error'); });
            });
            actions.appendChild(del);
            li.appendChild(actions);
            ul.appendChild(li);
          });
          art.appendChild(ul);
          grid.appendChild(art);
        });
      });
    }
  }

  // ======================================================== REMINDERS
  function mountReminders() {
    var p = panel('reminders');
    if (!p || p.querySelector('.wsx-composer')) return;

    var form = el('form', 'wsx-composer');
    form.innerHTML =
      '<input class="wsx-input" name="title" placeholder="Remind me to…" required maxlength="200" />' +
      '<input class="wsx-input wsx-input--date" type="datetime-local" name="scheduledAt" required aria-label="When" />' +
      '<button class="wsx-btn" type="submit">Add reminder</button>';

    var head = p.querySelector('.ws-page-head');
    if (head && head.nextSibling) head.parentNode.insertBefore(form, head.nextSibling);
    else p.insertBefore(form, p.firstChild);

    var listWrap = el('div', 'wsx-list');
    form.parentNode.insertBefore(listWrap, form.nextSibling);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button');
      var title = form.title.value.trim();
      var when = toIso(form.scheduledAt.value);
      if (!title || !when) return;
      busy(btn, true);
      API.request('/reminders', { method: 'POST', body: { title: title, scheduledAt: when } })
        .then(function () {
          form.reset();
          P.notify('Reminder set.');
          return renderReminders();
        })
        .catch(function (err) { P.notify(err.message, 'error'); })
        .finally(function () { busy(btn, false); });
    });

    renderReminders();

    function renderReminders() {
      return API.request('/reminders').then(function (items) {
        items = Array.isArray(items) ? items : [];
        // the read-only renderer's rows, replaced by ones that can be acted on
        Array.prototype.forEach.call(p.querySelectorAll('.ws-reminder-item'), function (n) { n.remove(); });
        listWrap.innerHTML = '';
        if (!items.length) {
          listWrap.appendChild(el('p', 'ws-section-label', 'No reminders yet — add one above.'));
          return;
        }
        items.forEach(function (r) {
          var row = el('div', 'wsx-row');
          var main = el('span', 'wsx-row__main');
          main.appendChild(el('span', 'wsx-row__title', r.title || r.message || 'Reminder'));
          var bits = [fmt(r.scheduledAt || r.remindAt)];
          if (r.status) bits.push(String(r.status).toLowerCase());
          if (r.recurrence) bits.push(String(r.recurrence).toLowerCase());
          if (r.message && r.message !== r.title) bits.push(r.message);
          main.appendChild(el('span', 'wsx-row__meta', bits.filter(Boolean).join(' · ')));
          row.appendChild(main);

          var actions = el('span', 'wsx-actions');
          if (String(r.status || '').toUpperCase() !== 'COMPLETED') {
            var ok = el('button', 'wsx-icon', '✓');
            ok.title = 'Mark done';
            ok.addEventListener('click', function () {
              API.request('/reminders/' + r.id + '/complete', { method: 'PATCH', body: {} })
                .then(function () { P.notify('Reminder completed.'); return renderReminders(); })
                .catch(function (err) { P.notify(err.message, 'error'); });
            });
            actions.appendChild(ok);

            var snooze = el('button', 'wsx-icon', '⏲');
            snooze.title = 'Snooze 10 minutes';
            snooze.addEventListener('click', function () {
              API.request('/reminders/' + r.id + '/snooze', { method: 'PATCH', body: { minutes: 10 } })
                .then(function () { P.notify('Snoozed 10 minutes.'); return renderReminders(); })
                .catch(function (err) { P.notify(err.message, 'error'); });
            });
            actions.appendChild(snooze);
          }
          var del = el('button', 'wsx-icon wsx-icon--danger', '×');
          del.title = 'Delete';
          del.addEventListener('click', function () {
            if (!window.confirm('Delete this reminder?')) return;
            API.request('/reminders/' + r.id, { method: 'DELETE' })
              .then(function () { P.notify('Reminder deleted.'); return renderReminders(); })
              .catch(function (err) { P.notify(err.message, 'error'); });
          });
          actions.appendChild(del);
          row.appendChild(actions);
          listWrap.appendChild(row);
        });
      });
    }
  }

  // ======================================================== LISTS
  function mountLists() {
    var p = panel('lists');
    var grid = document.getElementById('listGrid');
    if (!p || !grid || p.querySelector('.wsx-composer')) return;

    var form = el('form', 'wsx-composer');
    form.innerHTML =
      '<input class="wsx-input" name="name" placeholder="New list name" required maxlength="120" />' +
      '<button class="wsx-btn" type="submit">Create list</button>';
    grid.parentNode.insertBefore(form, grid);

    var detail = el('div', 'wsx-detail');
    detail.hidden = true;
    grid.parentNode.insertBefore(detail, grid.nextSibling);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button');
      var name = form.name.value.trim();
      if (!name) return;
      busy(btn, true);
      API.request('/lists', { method: 'POST', body: { name: name } })
        .then(function () { form.reset(); P.notify('List created.'); return renderLists(); })
        .catch(function (err) { P.notify(err.message, 'error'); })
        .finally(function () { busy(btn, false); });
    });

    renderLists();

    function renderLists() {
      return API.request('/lists').then(function (lists) {
        lists = Array.isArray(lists) ? lists : [];
        grid.innerHTML = '';
        if (!lists.length) {
          grid.appendChild(el('p', 'ws-section-label', 'No lists yet — create one above.'));
          return;
        }
        lists.forEach(function (l) {
          var card = el('div', 'ws-list-card wsx-clickable');
          card.appendChild(el('h4', null, l.name || 'Untitled list'));
          var count = (l.items && l.items.length) || (l._count && l._count.items) || 0;
          card.appendChild(el('p', null, count + (count === 1 ? ' item' : ' items') + ' · open'));
          card.addEventListener('click', function () { openList(l.id, l.name); });
          grid.appendChild(card);
        });
      });
    }

    /** A list card used to show only a count, with no way to see inside it. */
    function openList(id, name) {
      detail.hidden = false;
      detail.innerHTML = '';
      detail.appendChild(el('p', 'ws-section-label', 'Loading…'));
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      API.request('/lists/' + id).then(function (list) {
        detail.innerHTML = '';
        var head = el('div', 'wsx-detail__head');
        head.appendChild(el('h3', null, (list && list.name) || name || 'List'));
        var close = el('button', 'wsx-icon', '×');
        close.title = 'Close';
        close.addEventListener('click', function () { detail.hidden = true; });
        head.appendChild(close);
        detail.appendChild(head);

        var add = el('form', 'wsx-composer wsx-composer--inline');
        add.innerHTML =
          '<input class="wsx-input" name="content" placeholder="Add an item" required maxlength="200" />' +
          '<button class="wsx-btn" type="submit">Add</button>';
        add.addEventListener('submit', function (e) {
          e.preventDefault();
          var btn = add.querySelector('button');
          var content = add.content.value.trim();
          if (!content) return;
          busy(btn, true, 'Adding…');
          API.request('/lists/' + id + '/items', { method: 'POST', body: { content: content } })
            .then(function () { add.reset(); openList(id, name); return renderLists(); })
            .catch(function (err) { P.notify(err.message, 'error'); })
            .finally(function () { busy(btn, false); });
        });
        detail.appendChild(add);

        var items = (list && list.items) || [];
        if (!items.length) {
          detail.appendChild(el('p', 'ws-section-label', 'This list is empty.'));
          return;
        }
        var ul = el('ul', 'wsx-items');
        items.forEach(function (it) {
          var li = el('li', 'wsx-row');
          var main = el('label', 'wsx-row__main wsx-check');
          var box = document.createElement('input');
          box.type = 'checkbox';
          box.checked = !!it.isChecked;
          box.addEventListener('change', function () {
            API.request('/lists/' + id + '/items/' + it.id,
              { method: 'PUT', body: { isChecked: box.checked } })
              .then(function () { return renderLists(); })
              .catch(function (err) { P.notify(err.message, 'error'); box.checked = !box.checked; });
          });
          main.appendChild(box);
          main.appendChild(el('span', it.isChecked ? 'wsx-row__title wsx-done' : 'wsx-row__title',
            it.content || 'Item'));
          li.appendChild(main);

          var del = el('button', 'wsx-icon wsx-icon--danger', '×');
          del.title = 'Remove item';
          del.addEventListener('click', function () {
            API.request('/lists/' + id + '/items/' + it.id, { method: 'DELETE' })
              .then(function () { openList(id, name); return renderLists(); })
              .catch(function (err) { P.notify(err.message, 'error'); });
          });
          li.appendChild(del);
          ul.appendChild(li);
        });
        detail.appendChild(ul);
      }).catch(function (err) {
        detail.innerHTML = '';
        detail.appendChild(el('p', 'ws-section-label', 'Could not open list: ' + err.message));
      });
    }
  }

  // Panels are switched by workspace.js and may be hidden at load, so mount
  // once now and again whenever a view is opened.
  function mountAll() {
    try { mountTasks(); } catch (e) { /* one panel failing must not stop the rest */ }
    try { mountReminders(); } catch (e) {}
    try { mountLists(); } catch (e) {}
  }

  mountAll();
  document.addEventListener('click', function (e) {
    var nav = e.target.closest && e.target.closest('[data-view]');
    if (nav) window.setTimeout(mountAll, 60);
  });
});
