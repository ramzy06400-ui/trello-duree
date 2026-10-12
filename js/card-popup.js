/* global TrelloPowerUp, Duree */
var t = TrelloPowerUp.iframe();
var $ = function (i) { return document.getElementById(i); };
t.card('id', 'name', 'desc', 'attachments').then(function (card) {
  return Promise.all([t.get('card', 'shared'), Duree.get(t, card)]).then(function (r) {
    var d = r[1], data = r[0] || {};
    $('info').textContent = d ? 'Actuel : ' + Duree.fmt(d.sec) + ' (' + d.src + ')' : 'Durée non détectée automatiquement.';
    if (data.auto && typeof data.manuel === 'number') $('info').textContent += ' — auto : ' + Duree.fmt(data.auto.sec) + ' (' + data.auto.src + ')';
    if (d) $('v').value = Duree.fmt(d.sec);
  });
});
$('ok').onclick = function () {
  var s = Duree.parse($('v').value);
  if (s === null) { $('info').textContent = 'Format invalide : utilisez min:sec (ex. 2:05) ou minutes.'; return; }
  t.set('card', 'shared', 'manuel', s).then(function () { t.closePopup(); });
};
$('raz').onclick = function () { t.remove('card', 'shared', ['manuel', 'auto', 'autoUrl']).then(function () { t.closePopup(); }); };
document.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('ok').click(); });
