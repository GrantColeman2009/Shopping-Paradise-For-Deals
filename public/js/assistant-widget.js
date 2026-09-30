/* Shopping Paradise For Deals — floating AI support assistant widget.
 * Served as a static file so the site's Content-Security-Policy
 * (script-src 'self') stays intact. Always labelled as an AI assistant,
 * never as a human. No external calls — talks only to /api/assistant.
 */
(function () {
  var fab = document.getElementById('ai-help-fab');
  var panel = document.getElementById('ai-help-panel');
  var msgs = document.getElementById('ai-help-msgs');
  var chips = document.getElementById('ai-help-chips');
  var form = document.getElementById('ai-help-form');
  var input = document.getElementById('ai-help-input');
  var greeted = false;
  var csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }

  function addMsg(who, text) {
    var d = document.createElement('div');
    d.className = 'ai-msg ai-' + who;
    d.innerHTML = esc(text);
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function setChips(list) {
    chips.innerHTML = '';
    (list || []).forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ai-chip';
      b.textContent = c;
      b.onclick = function () { send(c); };
      chips.appendChild(b);
    });
  }

  function send(text) {
    text = (text || '').trim();
    if (!text) return;
    addMsg('user', text);
    input.value = '';
    setChips([]);
    fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ message: text })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        addMsg('bot', data.reply || 'Sorry — something went wrong. Please try again or file a support ticket.');
        setChips(data.followups || []);
      })
      .catch(function () {
        addMsg('bot', 'Sorry — I could not reach the assistant. Please try again or file a support ticket.');
      });
  }

  if (!fab || !panel) return; // widget not on this page

  fab.onclick = function () {
    panel.hidden = !panel.hidden;
    if (!panel.hidden && !greeted) {
      greeted = true;
      addMsg('bot', "Hi! I'm the Shopping Paradise For Deals AI assistant — automated, not a human. I can help with orders, shipping, returns, selling, fees, and payouts. What's going on?");
      setChips(['Where is my order?', 'How does free shipping work?', 'How do I sell on here?']);
    }
    if (!panel.hidden) input.focus();
  };
  document.getElementById('ai-help-close').onclick = function () { panel.hidden = true; };
  form.onsubmit = function (e) { e.preventDefault(); send(input.value); };
})();
