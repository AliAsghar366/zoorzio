// Zoorzio Profile — interactions

document.addEventListener('DOMContentLoaded', () => {
  // Change buttons: prompt for a new value and update the row
  document.querySelectorAll('.pf-change-btn[data-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetEl = document.getElementById(btn.dataset.target);
      if (!targetEl) return;
      const next = window.prompt(btn.dataset.prompt || 'Enter a new value', targetEl.textContent.trim());
      if (next && next.trim()) targetEl.textContent = next.trim();
    });
  });

  const passwordBtn = document.getElementById('passwordBtn');
  if (passwordBtn) {
    passwordBtn.addEventListener('click', () => {
      const next = window.prompt('Enter a new password');
      if (next && next.trim()) window.alert('Password updated.');
    });
  }

  // Danger zone toggle
  const dangerToggle = document.getElementById('dangerToggle');
  const dangerPanel = document.getElementById('dangerPanel');
  if (dangerToggle && dangerPanel) {
    dangerToggle.addEventListener('click', () => {
      const isOpen = dangerPanel.classList.toggle('is-open');
      dangerToggle.classList.toggle('is-open', isOpen);
      dangerToggle.setAttribute('aria-expanded', String(isOpen));
      dangerToggle.lastChild.textContent = isOpen ? ' Hide cancellation options' : ' Show cancellation options';
    });
  }

  // Sign out
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      if (window.confirm('Sign out of Zoorzio on this device?')) {
        window.location.href = 'index.html';
      }
    });
  }
});
