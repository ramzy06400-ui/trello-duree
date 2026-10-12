"""Serveur local de durées pour le Power-Up Trello « Durée ».
GET http://127.0.0.1:8765/duree?url=...  ->  {type, secondes, source, texte_mots}
Config optionnelle : config.json à côté du script, ex. {"cookiesfrombrowser": "firefox", "mots_par_minute": 200}
"""
import json, logging, os, re, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ICI = os.path.dirname(os.path.abspath(__file__))
CONF = {"hote": "127.0.0.1", "port": 8765, "mots_par_minute": 200, "sec_image": 5,
        "cookiesfrombrowser": None, "cache_jours": 30}
try:
    with open(os.path.join(ICI, "config.json"), encoding="utf-8") as f:
        CONF.update(json.load(f))
except FileNotFoundError:
    pass
CACHE_F = os.path.join(ICI, "cache_durees.json")
logging.basicConfig(filename=os.path.join(ICI, "duree_serveur.log"), level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s", encoding="utf-8")
log = logging.getLogger("duree")
verrou = threading.Lock()
try:
    with open(CACHE_F, encoding="utf-8") as f:
        CACHE = json.load(f)
except Exception:
    CACHE = {}

def sauver_cache():
    tmp = CACHE_F + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(CACHE, f, ensure_ascii=False)
    os.replace(tmp, CACHE_F)

IMG = re.compile(r"\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)", re.I)

def mots(txt):
    txt = re.sub(r"https?://\S+", "", txt or "")
    return len(re.findall(r"\S+", txt))

def lecture(n):
    return max(3, round(n / CONF["mots_par_minute"] * 60)) if n else 0

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"}

def http_get(url):
    import urllib.request
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=15) as r:
        return r.read(3_000_000).decode(r.headers.get_content_charset() or "utf-8", "replace")

def tweet(tid):
    d = json.loads(http_get(f"https://cdn.syndication.twimg.com/tweet-result?id={tid}&token=a"))
    n = mots(d.get("text"))
    ms = 0
    for m in d.get("mediaDetails") or []:
        ms += (m.get("video_info") or {}).get("duration_millis") or 0
    photos = len(d.get("photos") or [])
    if not ms and d.get("video"):
        ms = d["video"].get("durationMs") or 0
    sec = lecture(n) + round(ms / 1000) + CONF["sec_image"] * photos
    return {"type": "video" if ms else ("image" if photos and not n else "post"), "secondes": int(sec),
            "source": "x-syndication", "texte_mots": n}

def page(url):
    import html as H_
    h = http_get(url)
    h = re.sub(r"(?is)<(script|style|noscript|nav|header|footer|aside)\b.*?</\1>", " ", h)
    m = re.search(r"(?is)<article\b.*?</article>", h)
    zone = m.group(0) if m else h
    paras = re.findall(r"(?is)<p\b[^>]*>(.*?)</p>", zone)
    txt = H_.unescape(re.sub(r"<[^>]+>", " ", " ".join(paras)))
    if mots(txt) < 30:
        og = re.search(r'(?is)<meta[^>]+(?:property|name)=["\'](?:og:)?description["\'][^>]+content=["\']([^"\']*)', h)
        txt = H_.unescape(og.group(1)) if og else txt
    n = mots(txt)
    imgs = 0
    return {"type": "article" if n > 60 else "post", "secondes": lecture(n) + imgs, "source": "page-html", "texte_mots": n}

def analyser(url):
    tid = re.search(r"(?:twitter|x)\.com/[^/]+/status(?:es)?/(\d+)", url)
    if tid:
        try:
            return tweet(tid.group(1))
        except Exception as e:
            log.info("syndication échouée %s : %s", url, e)
    try:
        return analyser_ytdlp(url)
    except Exception as e:
        log.info("yt-dlp échoué %s : %s ; repli page HTML", url, e)
        r = page(url)
        if not r["texte_mots"]:
            raise
        return r

def analyser_ytdlp(url):
    if IMG.search(urlparse(url).path):
        return {"type": "image", "secondes": CONF["sec_image"], "source": "extension", "texte_mots": 0}
    import yt_dlp
    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True,
            "extract_flat": False, "socket_timeout": 15, "logger": log}
    if CONF.get("cookiesfrombrowser"):
        opts["cookiesfrombrowser"] = (CONF["cookiesfrombrowser"],)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    entrees = info.get("entries") if info.get("_type") == "playlist" else None
    items = [e for e in (entrees or [info]) if e]
    duree = sum(float(e.get("duration") or 0) for e in items)
    texte = info.get("description") or info.get("title") or ""
    if not info.get("description") and entrees:
        texte = " ".join((e.get("description") or e.get("title") or "") for e in items[:1])
    n = mots(texte)
    nb_img = sum(1 for e in items if not e.get("duration") and (e.get("thumbnails") or e.get("url")) and e.get("vcodec") == "none")
    if duree:
        typ, sec = "video", round(duree)
    else:
        typ, sec = ("post" if n else "image"), lecture(n) + CONF["sec_image"] * max(nb_img, 0 if n else 1)
    return {"type": typ, "secondes": int(sec), "source": "yt-dlp:" + (info.get("extractor_key") or "?"), "texte_mots": n}

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def _json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/sante":
            return self._json(200, {"ok": True})
        if u.path != "/duree":
            return self._json(404, {"erreur": "inconnu"})
        url = (parse_qs(u.query).get("url") or [""])[0].strip()
        if not re.match(r"^https?://", url):
            return self._json(400, {"erreur": "url manquante"})
        with verrou:
            c = CACHE.get(url)
        if c and time.time() - c.get("_t", 0) < CONF["cache_jours"] * 86400 and "refresh" not in u.query:
            return self._json(200, {k: v for k, v in c.items() if k != "_t"})
        try:
            r = analyser(url)
        except Exception as e:
            log.warning("échec %s : %s", url, e)
            return self._json(502, {"erreur": str(e)[:300]})
        log.info("%s -> %s", url, r)
        with verrou:
            CACHE[url] = dict(r, _t=time.time()); sauver_cache()
        self._json(200, r)

    def log_message(self, fmt, *a):
        log.info("%s %s", self.address_string(), fmt % a)

if __name__ == "__main__":
    srv = ThreadingHTTPServer((CONF["hote"], CONF["port"]), H)
    log.info("démarrage sur http://%s:%s", CONF["hote"], CONF["port"])
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
