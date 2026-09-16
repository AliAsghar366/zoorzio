/* Backend wiring for Explore.
 *
 * The clean-up flow reviews the signed-in user's real memories: "Forget"
 * deletes one through DELETE /memory/:id, "Keep" just moves on. Loaded after
 * explore.js, whose own handlers are replaced below so a click does not both
 * advance the mock list and call the API.
 */
document.addEventListener('DOMContentLoaded', function () {
  var P = window.Portal;
  if (!P || !P.authed) return;

  var reviewBody = document.getElementById('reviewBody');
  var reviewIndex = document.getElementById('reviewIndex');
  var memLeft = document.getElementById('memLeft');
  var memReviewed = document.getElementById('memReviewed');
  var forgetBtn = document.getElementById('forgetBtn');
  var keepBtn = document.getElementById('keepBtn');

  if (!reviewBody) return;

  // Drop explore.js's handlers, which walk a hard-coded array.
  function rebind(btn, handler) {
    if (!btn) return null;
    var fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', handler);
    return fresh;
  }

  var memories = [];
  var index = 0;
  var reviewed = 0;
  var busy = false;

  function label(m) {
    return (m.summary || m.content || 'Untitled memory').toString();
  }

  function render() {
    if (index >= memories.length) {
      reviewBody.textContent = memories.length
        ? "You're all caught up!"
        : 'Nothing to review yet.';
      if (reviewIndex) reviewIndex.textContent = String(memories.length);
      if (forgetBtn) forgetBtn.disabled = true;
      if (keepBtn) keepBtn.disabled = true;
      if (memLeft) memLeft.textContent = '0';
      return;
    }
    var text = label(memories[index]);
    reviewBody.textContent = text.length > 240 ? text.slice(0, 240) + '…' : text;
    if (reviewIndex) reviewIndex.textContent = String(index + 1);
    if (memLeft) memLeft.textContent = String(Math.max(memories.length - index, 0));
    if (memReviewed) memReviewed.textContent = String(reviewed);
    if (forgetBtn) forgetBtn.disabled = false;
    if (keepBtn) keepBtn.disabled = false;
  }

  function advance() {
    index += 1;
    reviewed += 1;
    render();
  }

  forgetBtn = rebind(forgetBtn, function () {
    if (busy || index >= memories.length) return;
    var m = memories[index];
    if (!m || !m.id) { advance(); return; }
    busy = true;
    forgetBtn.disabled = true;
    P.api.request('/memory/' + encodeURIComponent(m.id), { method: 'DELETE' })
      .then(function () { P.notify('Forgotten.'); advance(); })
      .catch(function (err) { P.notify(err.message, 'error'); })
      .finally(function () { busy = false; });
  });

  keepBtn = rebind(keepBtn, function () {
    if (busy || index >= memories.length) return;
    advance();
  });

  reviewBody.textContent = 'Loading your memories…';
  if (forgetBtn) forgetBtn.disabled = true;
  if (keepBtn) keepBtn.disabled = true;

  P.api.request('/memory')
    .then(function (data) {
      memories = Array.isArray(data) ? data : [];
      index = 0;
      reviewed = 0;
      render();
    })
    .catch(function (err) {
      reviewBody.textContent = 'Could not load your memories: ' + err.message;
    });
});
