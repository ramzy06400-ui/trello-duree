/* Logique partagée : détection et stockage des durées (pluginData uniquement, jamais la carte). */
var Duree = (function () {
  var WPM = 200, IMG_SEC = 5;
  function fmt(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function parse(str) {
    str = String(str || '').trim(); if (!str) return null;
    var m = str.match(/^(\d+)(?::(\d{1,2}))?$/); if (!m) return null;
    return m[2] !== undefined ? (+m[1]) * 60 + (+m[2]) : (+m[1]) * 60;
  }
  function words(txt) { return (String(txt || '').replace(/https?:\/\/\S+/g, '').match(/\S+/g) || []).length; }
  function readSec(txt) { var w = words(txt); return w ? Math.max(3, Math.round(w / WPM * 60)) : 0; }
  function iso(d) { var m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || ''); return m ? (+(m[1]||0))*86400+(+(m[2]||0))*3600+(+(m[3]||0))*60+(+(m[4]||0)) : 0; }
  function cardUrl(card) {
    var n = (card.name || '').trim();
    if (/^https?:\/\/\S+$/.test(n)) return n;
    var a = (card.attachments || [])[0]; if (a && a.url) return a.url;
    var m = n.match(/https?:\/\/\S+/) || (card.desc || '').match(/https?:\/\/\S+/); return m ? m[0] : null;
  }
  function ytId(u) { var m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/); return m && m[1]; }
  function tweetId(u) { var m = u.match(/(?:twitter|x)\.com\/[^/]+\/status(?:es)?\/(\d+)/); return m && m[1]; }
  function jsonp(url) {
    return new Promise(function (ok, ko) {
      var cb = 'dureeCb' + Date.now() + Math.floor(Math.random() * 1e6), s = document.createElement('script');
      window[cb] = function (d) { delete window[cb]; s.remove(); ok(d); };
      s.onerror = function () { delete window[cb]; s.remove(); ko(new Error('jsonp')); };
      s.src = url + '&callback=' + cb; document.head.appendChild(s);
      setTimeout(function () { if (window[cb]) { delete window[cb]; s.remove(); ko(new Error('timeout')); } }, 8000);
    });
  }
  function tweetSec(id, url) {
    return fetch('https://cdn.syndication.twimg.com/tweet-result?id=' + id + '&token=a')
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var s = readSec(d.text), v = d.video || (d.mediaDetails || []).find(function (m) { return m.video_info; });
        var ms = (v && v.video_info && v.video_info.duration_millis) || (d.video && d.video.durationMs) || 0;
        if (!ms && (d.photos || []).length) s += IMG_SEC * d.photos.length;
        return { sec: s + Math.round(ms / 1000), src: ms ? 'tweet+vidéo' : 'tweet' };
      })
      .catch(function () {
        return jsonp('https://publish.twitter.com/oembed?omit_script=1&url=' + encodeURIComponent(url))
          .then(function (d) { var div = document.createElement('div'); div.innerHTML = d.html || ''; var p = div.querySelector('p');
            return { sec: readSec(p ? p.textContent : div.textContent), src: 'tweet (texte)' }; });
      });
  }
  var SERVEUR = 'http://127.0.0.1:8765';
  function local(u) {
    var ctl = window.AbortController ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
    return fetch(SERVEUR + '/duree?url=' + encodeURIComponent(u), ctl ? { signal: ctl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('serveur ' + r.status); return r.json(); })
      .then(function (d) { if (typeof d.secondes !== 'number') throw new Error('réponse'); return { sec: d.secondes, src: 'local:' + (d.type || '') + ' ' + (d.source || '') }; })
      .finally(function () { clearTimeout(tm); });
  }
  function detect(card, ytKey) {
    var u = cardUrl(card);
    if (u) return local(u).catch(function () { return detectWeb(card, ytKey, u); });
    return detectWeb(card, ytKey, u);
  }
  function detectWeb(card, ytKey, u) {
    if (!u) { var s = readSec((card.name || '') + ' ' + (card.desc || '')); return Promise.resolve(s ? { sec: s, src: 'texte' } : null); }
    var y = ytId(u);
    if (y) {
      if (!ytKey) return Promise.resolve(null);
      return fetch('https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=' + y + '&key=' + encodeURIComponent(ytKey))
        .then(function (r) { return r.json(); })
        .then(function (d) { var it = (d.items || [])[0]; return it ? { sec: iso(it.contentDetails.duration), src: 'YouTube' } : null; });
    }
    var tw = tweetId(u); if (tw) return tweetSec(tw, u);
    if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(u) || /pbs\.twimg\.com\/media|i\.imgur\.com/.test(u)) return Promise.resolve({ sec: IMG_SEC, src: 'image' });
    var a = (card.attachments || [])[0]; if (a && /^image\//.test(a.mimeType || '')) return Promise.resolve({ sec: IMG_SEC, src: 'image' });
    // Article : on ne peut pas lire la page (CORS) ; on utilise le texte de la carte s'il y en a.
    var t = readSec((card.desc || '') + ' ' + (card.name === u ? '' : card.name));
    return Promise.resolve(t ? { sec: t, src: 'texte carte' } : null);
  }
  // Renvoie {sec, src, manual} ; t peut cibler une autre carte via cardId.
  function get(t, card, opts) {
    opts = opts || {}; var scope = opts.cardId || 'card', u = cardUrl(card) || ('txt:' + (card.name || '').length);
    return read(t.get(scope, 'shared'));
    function read(p) {
      return p.then(function (d) {
        d = d || {};
        if (typeof d.manuel === 'number') return { sec: d.manuel, src: 'manuel', manual: true };
        if (d.auto && d.autoUrl === u && typeof d.auto.sec === 'number') return d.auto;
        if (opts.noFetch) return null;
        return t.get('board', 'private', 'ytKey').then(function (k) { return detect(card, k); })
          .then(function (r) { if (r) { return t.set(scope, 'shared', { auto: r, autoUrl: u }).catch(function () {}).then(function () { return r; }); } return null; })
          .catch(function () { return null; });
      });
    }
  }
  return { fmt: fmt, parse: parse, get: get, cardUrl: cardUrl, detect: detect };
})();
