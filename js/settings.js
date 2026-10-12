/* global TrelloPowerUp */
var t = TrelloPowerUp.iframe();
var k = document.getElementById('k');
t.get('board', 'private', 'ytKey').then(function (v) { k.value = v || ''; });
document.getElementById('ok').onclick = function () {
  var v = k.value.trim();
  (v ? t.set('board', 'private', 'ytKey', v) : t.remove('board', 'private', 'ytKey')).then(function () { t.closePopup(); });
};
