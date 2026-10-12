/* global TrelloPowerUp, Duree */
var ICON = 'https://cdn-icons-png.flaticon.com/512/2088/2088617.png';
var CARD_FIELDS = ['id', 'name', 'desc', 'attachments', 'idList'];

function boardTotal(t) {
  return Promise.all([t.cards.apply(t, CARD_FIELDS), t.get('board', 'shared')]).then(function (r) {
    var cfg = r[1] || {}, cards = r[0].filter(function (c) { return !cfg.liste || c.idList === cfg.liste; });
    return Promise.all(cards.map(function (c) { return Duree.get(t, c, { cardId: c.id, noFetch: true }); }))
      .then(function (ds) { var s = 0, inconnues = 0; ds.forEach(function (d) { if (d) s += d.sec; else inconnues++; });
        return { sec: s, cible: cfg.cible || 20, inconnues: inconnues, n: cards.length }; });
  });
}

TrelloPowerUp.initialize({
  'card-badges': function (t) {
    return t.card.apply(t, CARD_FIELDS).then(function (card) {
      var res = null, enCours = false;
      function lancer() {
        if (enCours) return; enCours = true;
        Duree.get(t, card).then(function (d) { res = d || false; }).catch(function () { res = false; })
          .then(function () { enCours = false; });
      }
      return [{ dynamic: function () {
        if (res === null) lancer();
        var d = res;
        if (d === null) return { text: '⏱ …', color: 'light-gray', refresh: 10 };
        if (!d) { res = null; return { text: '⏱ ?', color: 'light-gray', refresh: 60 }; }
        return { text: '⏱ ' + Duree.fmt(d.sec), color: d.manual ? 'blue' : null, refresh: 120 };
      } }];
    });
  },
  'card-detail-badges': function (t) {
    return t.card.apply(t, CARD_FIELDS).then(function (card) {
      return Duree.get(t, card).then(function (d) {
        return [{ title: 'Durée', text: d ? '⏱ ' + Duree.fmt(d.sec) + (d.manual ? ' (manuel)' : '') : '⏱ à saisir',
          color: d && d.manual ? 'blue' : null,
          callback: function (t) { return t.popup({ title: 'Durée de la carte', url: './card-popup.html', height: 190 }); } }];
      });
    });
  },
  'board-buttons': function (t) {
    return boardTotal(t).catch(function () { return { sec: 0, cible: 20 }; }).then(function (b) {
      return [{ icon: { dark: ICON, light: ICON }, text: '⏱ ' + Duree.fmt(b.sec) + ' / ' + b.cible + ':00',
        callback: function (t) { return t.popup({ title: 'Durée totale', url: './board-popup.html', height: 260 }); } }];
    });
  },
  'show-settings': function (t) {
    return t.popup({ title: 'Réglages Durée', url: './settings.html', height: 220 });
  }
});
