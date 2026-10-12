/* global TrelloPowerUp, Duree */
var t = TrelloPowerUp.iframe();
var $ = function (i) { return document.getElementById(i); };
var busy = false;
t.lists('id', 'name').then(function (ls) {
  ls.forEach(function (l) { var o = document.createElement('option'); o.value = l.id; o.textContent = 'Liste : ' + l.name; $('liste').appendChild(o); });
  return t.get('board', 'shared');
}).then(function (c) { c = c || {}; $('cible').value = String(c.cible || 20); $('liste').value = c.liste || ''; refresh(); });
$('cible').onchange = function () { t.set('board', 'shared', 'cible', +this.value).then(refresh); };
$('liste').onchange = function () { t.set('board', 'shared', 'liste', this.value || null).then(refresh); };
function refresh() {
  if (busy) return; busy = true;
  Promise.all([t.cards('id', 'name', 'desc', 'attachments', 'idList'), t.get('board', 'shared')]).then(function (r) {
    var cfg = r[1] || {}, cible = (cfg.cible || 20) * 60;
    var cards = r[0].filter(function (c) { return !cfg.liste || c.idList === cfg.liste; });
    return Promise.all(cards.map(function (c) { return Duree.get(t, c, { cardId: c.id }); })).then(function (ds) {
      var s = 0, inc = 0; ds.forEach(function (d) { if (d) s += d.sec; else inc++; });
      var pct = s / cible * 100;
      $('tot').textContent = '⏱ ' + Duree.fmt(s) + ' / ' + Duree.fmt(cible) + ' (' + (s / 60).toFixed(1) + ' min)';
      $('fill').style.width = Math.min(100, pct) + '%';
      $('fill').style.background = pct > 100 ? '#e2483d' : pct >= 90 ? '#f5a623' : '#22a06b';
      $('det').textContent = cards.length + ' carte(s) ouverte(s), ' + Math.round(pct) + ' % de la cible' + (inc ? ' — ' + inc + ' sans durée (à saisir)' : '');
    });
  }).catch(function (e) { $('det').textContent = 'Erreur : ' + e.message; }).then(function () { busy = false; });
}
setInterval(refresh, 3000);
