// Reminder card shown in the always-on-top notifications window. Talks to the main process via window.tempo.send.
(function () {
  var q = new URLSearchParams(location.search);
  var send = function (action) { if (window.tempo) window.tempo.send('card-action', { id: q.get('id'), key: q.get('key'), url: q.get('url'), action: action }); };
  document.getElementById('t').textContent = q.get('title') || '';
  document.getElementById('s').textContent = q.get('body') || '';
  if (q.get('color')) document.getElementById('card').style.setProperty('--c', q.get('color'));
  var row = document.getElementById('row');
  var add = function (label, action, primary) { var b = document.createElement('button'); b.textContent = label; if (primary) b.className = 'p'; b.onclick = function () { send(action); }; row.appendChild(b); };
  if (q.get('url')) add(q.get('join') || 'Join', 'join', true);
  add(q.get('open') || 'Open', 'open', !q.get('url'));
  add(q.get('later') || 'Dismiss', 'dismiss', false);
  document.getElementById('x').onclick = function () { send('dismiss'); };
})();
