// Coffee with Zoorzio — conversation, backed by POST /chat.

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.coffee__nav');
  const chat = document.getElementById('chat');
  const input = document.querySelector('.coffee__chat-input input');
  const sendBtn = document.querySelector('.ai-input__send');
  const changeDrinkBtn = document.querySelector('.coffee__change-drink');
  const cupLiquid = document.querySelector('.coffee__cup-liquid');
  const P = window.Portal;

  if (nav) {
    nav.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (!item || item.tagName === 'A') return;
      nav.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('is-active'));
      item.classList.add('is-active');
    });
  }

  // The assistant needs the whole exchange each time, so keep it here.
  const history = [];
  let busy = false;

  function bubble(role, text) {
    const el = document.createElement('div');
    el.className = 'chat__bubble chat__bubble--' + (role === 'user' ? 'user' : 'assistant');
    el.textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    // Below 980px the whole page scrolls rather than #chat, so the newest
    // message would otherwise land behind the pinned input.
    if (window.matchMedia('(max-width: 980px)').matches) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }
    return el;
  }

  // The page used to open on seven hardcoded messages - a design review at
  // 11:30, a website launch, and "Done - I'll nudge you at 10:30 AM" - none of
  // which were real. The last one read as a reminder having been set. Open on
  // an honest greeting instead, using the signed-in user's name.
  if (chat) {
    const user = P && P.api && P.api.getUser ? P.api.getUser() : null;
    const first = user && P.firstName ? P.firstName(user) : '';
    bubble(
      'assistant',
      (first ? 'Hi ' + first + '! ' : 'Hi! ') +
        'Ask me about your tasks, reminders, lists or calendar - or tell me ' +
        'something to remember. Try "what do I have today?"'
    );
  }

  function sendMessage(preset) {
    if (!chat || busy) return;
    const text = (preset !== undefined ? preset : (input ? input.value : '')).trim();
    if (!text) return;

    bubble('user', text);
    history.push({ role: 'user', content: text });
    if (input) input.value = '';

    if (!P || !P.api.isConfigured()) {
      bubble('assistant', 'I’m not connected to the backend yet, so I can’t reply.');
      return;
    }

    busy = true;
    if (sendBtn) sendBtn.disabled = true;
    const pending = bubble('assistant', '…');
    pending.classList.add('is-pending');

    P.api.request('/chat', { method: 'POST', body: { messages: history } })
      .then((data) => {
        const reply = (data && data.reply) || 'I didn’t catch that — could you say it again?';
        pending.classList.remove('is-pending');
        pending.textContent = reply;
        history.push({ role: 'assistant', content: reply });
      })
      .catch((err) => {
        pending.classList.remove('is-pending');
        pending.textContent = 'Sorry — I couldn’t reach the assistant just now.';
        // Drop the unanswered turn so the next send isn't sent twice.
        history.pop();
        if (P) P.notify(err.message, 'error');
      })
      .finally(() => {
        busy = false;
        if (sendBtn) sendBtn.disabled = false;
        chat.scrollTop = chat.scrollHeight;
      });
  }

  if (sendBtn) sendBtn.addEventListener('click', () => sendMessage());
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });
  }

  // A question typed on the portal home is handed over here.
  try {
    const pendingMsg = sessionStorage.getItem('zoorzio_pending_message');
    if (pendingMsg) {
      sessionStorage.removeItem('zoorzio_pending_message');
      sendMessage(pendingMsg);
    }
  } catch (err) {}

  const drinks = [
    'linear-gradient(90deg, #AC84CC, #9283D9 50%, #7EA9E4)',
    'linear-gradient(90deg, #DC8CC5, #F9979D 50%, #FCAD96)',
    'linear-gradient(90deg, #7EA9E4, #9283D9 50%, #AC84CC)',
    'linear-gradient(90deg, #FCAD96, #F5CAA2 50%, #F9979D)',
  ];
  let drinkIndex = 0;

  if (changeDrinkBtn && cupLiquid) {
    changeDrinkBtn.addEventListener('click', () => {
      drinkIndex = (drinkIndex + 1) % drinks.length;
      cupLiquid.style.background = drinks[drinkIndex];
    });
  }
});
