# Power-Up Trello « Durée » ⏱

Affiche la durée de chaque carte (vidéo YouTube, tweet, image, texte) et le total du tableau par rapport à une cible de 20 ou 25 min.
**Le Power-Up ne modifie jamais les cartes** : tout est stocké dans les données privées du Power-Up (`t.set`, pluginData), invisibles sur la carte. Les aperçus de liens restent intacts.

## 1. Héberger gratuitement sur GitHub Pages
1. Créez un compte sur https://github.com (si besoin).
2. Cliquez **New repository**, nommez-le `trello-duree`, cochez **Public**, puis **Create repository**.
3. Cliquez **uploading an existing file** et glissez *tout le contenu* du dossier (index.html, les .html, style.css, le dossier `js/`). **Commit changes**.
4. Dans le dépôt : **Settings → Pages** → Source : *Deploy from a branch*, branche `main`, dossier `/ (root)` → **Save**.
5. Après 1–2 minutes, votre URL est : `https://VOTRE-PSEUDO.github.io/trello-duree/` (ouvrez `.../index.html` pour vérifier : page blanche = normal).

## 2. Déclarer le Power-Up dans Trello
1. Ouvrez https://trello.com/power-ups/admin (il faut être admin d'un Espace de travail).
2. **Nouveau** → nom « Durée », choisissez l'Espace de travail, **URL du connecteur iframe** : `https://VOTRE-PSEUDO.github.io/trello-duree/index.html`, e-mail et contact → **Créer**.
3. Onglet **Capacités** : activez `card-badges`, `card-detail-badges`, `board-buttons`, `show-settings`.
4. Pour modifier plus tard : même page, éditez l'app (l'URL peut être changée).

## 3. L'activer sur chaque tableau
Un Power-Up personnalisé s'active **tableau par tableau** : sur le tableau → **Power-Ups** → onglet **Personnalisé** → « Durée » → **Ajouter**. Répétez pour chaque tableau (uniquement les tableaux de cet Espace de travail).
Plan gratuit : depuis 2021 Trello autorise un nombre illimité de Power-Ups par tableau, même en gratuit ; aucune limite à prévoir (vérifiez si Atlassian change ses conditions).

## Utilisation
- **Badge de carte** `⏱ m:ss` (bleu = valeur manuelle, `⏱ ?` = inconnue).
- **Ouvrir la carte → badge « Durée »** : saisir `min:sec` (ex. `1:45`) ou un nombre de minutes. La valeur manuelle prime toujours. « Revenir à l'automatique » efface la saisie.
- **Bouton du tableau** `⏱ 7:30 / 20:00` : barre (verte, orange dès 90 %, rouge au-delà), total en minutes, choix de la cible 20/25 min et de la portée (tout le tableau ou une liste). Rafraîchi toutes les 3 s tant que la fenêtre est ouverte.
- **Réglages** (Power-Ups → Durée → ⚙ Réglages) : clé API YouTube facultative.

### Obtenir une clé YouTube (facultatif)
https://console.cloud.google.com → nouveau projet → *API et services* → activer **YouTube Data API v3** → *Identifiants* → **Créer une clé API**. Conseillé : restreindre la clé à l'API YouTube et au référent `https://VOTRE-PSEUDO.github.io/*`.

## Détection automatique
L'URL utilisée : le nom de la carte s'il s'agit d'une URL, sinon la 1re pièce jointe/lien, sinon un lien trouvé dans le nom ou la description.
| Type | Automatique | Méthode |
|---|---|---|
| YouTube (watch, youtu.be, shorts, live) | oui **si clé API**, sinon manuel | API YouTube Data v3 |
| X / Twitter | oui (best effort) | texte à 200 mots/min + durée vidéo (si fournie) + 5 s/photo, via cdn.syndication.twimg.com, repli publish.twitter.com/oembed (texte seul) |
| Image (.jpg, .png, .gif, .webp…, pbs.twimg, imgur, pièce jointe image) | oui | 5 s |
| Article / autre lien | partiel | temps de lecture du texte de la carte (description) ; la page elle-même ne peut pas être lue |
| Carte texte sans lien | oui | temps de lecture du nom + description |

## Limites réelles
- **Articles web** : un navigateur ne peut pas télécharger une page d'un autre site (CORS) ; sans serveur, le temps de lecture de l'article n'est pas calculable → saisie manuelle.
- **X/Twitter** : endpoints non officiels, susceptibles de casser ou d'être bloqués ; tweets privés/supprimés non lus ; durée vidéo seulement si l'endpoint syndication répond (oembed ne donne que le texte). Threads : seul le premier tweet compte.
- **YouTube sans clé** : rien d'automatique. Quota gratuit : 10 000 unités/jour (1 unité par vidéo, mise en cache ensuite). La clé est privée à votre compte : les autres membres du tableau doivent saisir la leur, ou ils verront les durées déjà mises en cache.
- **Cache** : la durée auto est calculée lors de l'affichage du badge (ou du popup du tableau) puis mémorisée ; elle est recalculée si l'URL change. Les membres en lecture seule ne peuvent pas écrire le cache.
- **Bouton du tableau** : son libellé est calculé au chargement du tableau (Trello ne permet pas de le rafraîchir en direct) ; c'est le popup qui est en direct.
- **Total** : seules les cartes ouvertes (non archivées) comptent ; les cartes sans durée sont signalées et comptées 0.
- Stockage pluginData limité à 4 096 caractères par carte/tableau (largement suffisant ici).
- Couleur orange : Trello n'affiche que ses couleurs de badge ; la barre de progression, elle, utilise vert/orange/rouge.

## Serveur local (détection automatique complète, gratuite et illimitée)
Le dossier `serveur/` contient un petit serveur (Python + yt-dlp) qui tourne sur votre PC à `http://127.0.0.1:8765`. Le Power-Up l'interroge **en premier** pour chaque lien (20 s maximum) ; s'il ne répond pas, il revient aux méthodes ci-dessus. La valeur manuelle prime toujours, et les cartes ne sont jamais modifiées.

### Installation (Windows, une seule fois)
1. Installez Python 3.13 depuis https://www.python.org/downloads/ (cochez **Add python.exe to PATH**).
2. Copiez le dossier `serveur` dans un endroit fixe, par ex. `C:\Users\VOUS\trello-duree-serveur`.
3. Clic droit sur `installer_serveur.ps1` → **Exécuter avec PowerShell** (si Windows bloque : ouvrir PowerShell dans le dossier et lancer `powershell -ExecutionPolicy Bypass -File .\installer_serveur.ps1`).
   Cela installe yt-dlp, crée la tâche planifiée « TrelloDureeServeur » (au démarrage de session, sans fenêtre, via pythonw) et la lance tout de suite.
4. Vérification : ouvrez http://127.0.0.1:8765/sante → `{"ok": true}`.
5. Mettez à jour yt-dlp de temps en temps (les sites changent) : `python -m pip install -U yt-dlp`.

### Ce que détecte le serveur
| Lien | Résultat |
|---|---|
| YouTube, TikTok, Facebook (vidéos publiques), vidéos X | durée de la vidéo (yt-dlp), sans clé API |
| Tweet texte/photo | mots à 200 mots/min + 5 s par photo (endpoint syndication de X) |
| Article web | temps de lecture du texte de la page |
| Image directe | 5 s |
| Instagram | **nécessite généralement d'être connecté** : voir ci-dessous |

Fichiers produits à côté du script : `cache_durees.json` (cache par URL, 30 jours ; ajouter `&refresh=1` à l'URL pour forcer) et `duree_serveur.log`.

### Instagram / Facebook : cookies
Créez `config.json` dans le dossier du serveur :
```json
{"cookiesfrombrowser": "firefox"}
```
(valeurs possibles : `firefox`, `chrome`, `edge`, `brave`…) puis redémarrez la tâche (`Stop-ScheduledTask TrelloDureeServeur; Start-ScheduledTask TrelloDureeServeur`). Soyez connectée à Instagram dans ce navigateur. **Firefox est conseillé** : Chrome et Edge chiffrent leurs cookies (App-Bound Encryption) et yt-dlp ne peut souvent pas les lire, surtout quand le navigateur est ouvert. Vos cookies restent sur votre PC.

### Limites du serveur
- Il ne marche que sur le PC où il tourne : Trello sur téléphone ou sur un autre ordinateur retombe sur les anciennes méthodes (ou affiche les durées déjà en cache sur la carte).
- Instagram (et certains contenus Facebook) refuse sans connexion ; un usage massif peut provoquer des limitations temporaires de votre compte.
- Si un site change, yt-dlp doit être mis à jour ; les tweets supprimés ou privés renvoient une erreur.
- Carrousels / posts photo Instagram : estimation (texte + 5 s par image) seulement si yt-dlp renvoie les éléments.
