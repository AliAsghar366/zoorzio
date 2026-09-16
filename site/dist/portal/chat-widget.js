/* Talk to Zoorzio from any portal page.
 *
 * The only place to converse was the Chat page. The Workspace - where tasks,
 * reminders and lists actually live - had no way to talk to the assistant at
 * all, so asking it to add a task meant leaving the thing you were looking at.
 *
 * This adds a floating "Ask Zoorzio" button and a panel. Replies come from the
 * same POST /chat the Chat page uses. After every reply it announces
 * "zoorzio:data-changed", so an open Workspace re-reads its panels and whatever
 * the assistant just created appears without a reload.
 */
(function () {
  function start() {
    var P = window.Portal;
    if (!P || !P.authed || document.getElementById('zwChat')) return;

    var css = document.createElement('style');
    css.textContent = [
      '.zw-fab{position:fixed;right:20px;bottom:20px;z-index:60;display:flex;align-items:center;gap:8px;',
      'padding:13px 18px;border:none;border-radius:999px;cursor:pointer;font:600 14px/1 inherit;',
      "font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#fff;",
      'background:linear-gradient(135deg,#9333EA,#EC4899);box-shadow:0 12px 30px rgba(90,40,130,.38)}',
      '.zw-fab svg{width:18px;height:18px}',
      '.zw-panel{position:fixed;right:20px;bottom:84px;z-index:61;width:min(380px,calc(100vw - 32px));',
      'height:min(560px,calc(100vh - 120px));display:flex;flex-direction:column;border-radius:20px;overflow:hidden;',
      "font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#fff;color:#2a1c3d;",
      'box-shadow:0 24px 60px rgba(40,20,70,.35)}',
      '.zw-panel[hidden]{display:none}',
      '.zw-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;color:#fff;',
      'background:linear-gradient(135deg,#9333EA,#EC4899)}',
      '.zw-head strong{font-size:15px}.zw-head span{font-size:12px;opacity:.85;display:block}',
      '.zw-x{border:none;background:rgba(255,255,255,.2);color:#fff;width:30px;height:30px;border-radius:9px;',
      'cursor:pointer;font-size:18px;line-height:1}',
      '.zw-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;background:#faf7fd}',
      '.zw-msg{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;',
      'white-space:pre-wrap;word-wrap:break-word}',
      '.zw-me{align-self:flex-end;background:#9333EA;color:#fff;border-bottom-right-radius:4px}',
      '.zw-bot{align-self:flex-start;background:#fff;border:1px solid #ece3f5;border-bottom-left-radius:4px}',
      '.zw-wait{opacity:.6;font-style:italic}',
      '.zw-form{display:flex;gap:8px;padding:10px;border-top:1px solid #ece3f5;background:#fff}',
      '.zw-in{flex:1;min-width:0;padding:11px 13px;border:1px solid #ddd0ea;border-radius:12px;font:inherit;',
      'font-size:14px;outline:none;color:#2a1c3d}',
      '.zw-in:focus{border-color:#9333EA}',
      '.zw-send{border:none;border-radius:12px;padding:0 16px;font:600 14px/1 inherit;color:#fff;cursor:pointer;',
      'background:linear-gradient(135deg,#9333EA,#EC4899)}',
      '.zw-send[disabled]{opacity:.5;cursor:not-allowed}',
      '.zw-tips{display:flex;flex-wrap:wrap;gap:6px}',
      '.zw-tip{border:1px solid #ddd0ea;background:#fff;border-radius:999px;padding:6px 10px;font:inherit;',
      'font-size:12px;color:#6b4c8a;cursor:pointer}',
      '@media (max-width:560px){.zw-panel{right:16px;left:16px;width:auto;bottom:80px;height:calc(100vh - 110px)}',
      '.zw-fab{right:16px;bottom:16px}}'
    ].join('');
    document.head.appendChild(css);

    var fab = document.createElement('button');
    fab.className = 'zw-fab';
    fab.type = 'button';
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none"><path d="M5 18l-1.5 3 4-1.2A9 9 0 1 0 5 18Z" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span>Ask Zoorzio</span>';

    var panel = document.createElement('section');
    panel.className = 'zw-panel';
    panel.id = 'zwChat';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Chat with Zoorzio');
    panel.innerHTML =
      '<div class="zw-head"><div><strong>Zoorzio</strong><span>Ask, or tell me what to do</span></div>' +
      '<button class="zw-x" type="button" aria-label="Close chat">×</button></div>' +
      '<div class="zw-log" role="log" aria-live="polite"></div>' +
      '<form class="zw-form"><input class="zw-in" placeholder="Message Zoorzio…" ' +
      'aria-label="Message Zoorzio" autocomplete="off" maxlength="2000" />' +
      '<button class="zw-send" type="submit">Send</button></form>';

    document.body.appendChild(panel);
    document.body.appendChild(fab);

    var log = panel.querySelector('.zw-log');
    var form = panel.querySelector('.zw-form');
    var input = panel.querySelector('.zw-in');
    var send = panel.querySelector('.zw-send');
    var history = [];
    var busy = false;

    function add(cls, text) {
      var n = document.createElement('div');
      n.className = 'zw-msg ' + cls;
      n.textContent = text;
      log.appendChild(n);
      log.scrollTop = log.scrollHeight;
      return n;
    }

    // Greeting plus tappable examples, so an empty panel is never a dead end.
    var user = P.api.getUser ? P.api.getUser() : null;
    var first = user && P.firstName ? P.firstName(user) : '';
    add('zw-bot', (first ? 'Hi ' + first + '! ' : 'Hi! ') +
      'I can add tasks, set reminders, update lists and answer questions about your day.');
    var tips = document.createElement('div');
    tips.className = 'zw-tips';
    ['What do I have today?', 'Remind me in 10 minutes to stretch', 'Add bread to my shopping list']
      .forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'zw-tip';
        b.textContent = t;
        b.addEventListener('click', function () { submit(t); });
        tips.appendChild(b);
      });
    log.appendChild(tips);

    function toggle(open) {
      var show = open === undefined ? panel.hidden : open;
      panel.hidden = !show;
      fab.setAttribute('aria-expanded', String(show));
      if (show) window.setTimeout(function () { input.focus(); }, 30);
    }

    function submit(preset) {
      var text = (preset !== undefined ? preset : input.value).trim();
      if (!text || busy) return;
      if (tips.parentNode) tips.remove();
      add('zw-me', text);
      input.value = '';
      history.push({ role: 'user', content: text });

      busy = true;
      send.disabled = true;
      var wait = add('zw-bot zw-wait', 'Zoorzio is thinking…');

      P.api.request('/chat', { method: 'POST', body: { messages: history } })
        .then(function (data) {
          var reply = (data && data.reply) || 'I didn’t catch that — could you say it again?';
          wait.classList.remove('zw-wait');
          wait.textContent = reply;
          history.push({ role: 'assistant', content: reply });
          // Whatever the assistant just did, let the page show it.
          document.dispatchEvent(new CustomEvent('zoorzio:data-changed'));
        })
        .catch(function (err) {
          wait.classList.remove('zw-wait');
          wait.textContent = 'Sorry — I couldn’t reach Zoorzio just now. ' + (err && err.message ? err.message : '');
          history.pop();
        })
        .finally(function () {
          busy = false;
          send.disabled = false;
          input.focus();
        });
    }

    fab.addEventListener('click', function () { toggle(); });
    panel.querySelector('.zw-x').addEventListener('click', function () { toggle(false); });
    form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) toggle(false);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
