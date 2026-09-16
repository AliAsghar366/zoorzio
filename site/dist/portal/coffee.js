// Coffee with Zoorzio — micro-interactions

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.coffee__nav');
  const chat = document.getElementById('chat');
  const input = document.querySelector('.coffee__chat-input input');
  const sendBtn = document.querySelector('.ai-input__send');
  const changeDrinkBtn = document.querySelector('.coffee__change-drink');
  const cupLiquid = document.querySelector('.coffee__cup-liquid');

  if (nav) {
    nav.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (!item || item.tagName === 'A') return;
      nav.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('is-active'));
      item.classList.add('is-active');
    });
  }

  function sendMessage() {
    if (!input || !chat) return;
    const text = input.value.trim();
    if (!text) return;

    const bubble = document.createElement('div');
    bubble.className = 'chat__bubble chat__bubble--user';
    bubble.textContent = text;
    chat.appendChild(bubble);
    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    setTimeout(() => {
      const reply = document.createElement('div');
      reply.className = 'chat__bubble chat__bubble--assistant';
      reply.textContent = "Got it — I'm on it. I'll follow up shortly.";
      chat.appendChild(reply);
      chat.scrollTop = chat.scrollHeight;
    }, 700);
  }

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

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
