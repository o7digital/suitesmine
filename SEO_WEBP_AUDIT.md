# Audit SEO + WebP (clone Astro)

Base d’analyse (HTML statique cloné) :
- index.html
- site-mirror/suitesmine.com/en/index.html
- site-mirror/suitesmine.com/en/about-the-hotel/index.html
- site-mirror/suitesmine.com/en/local-activities/index.html

## SEO — problèmes prioritaires
1) **Données SEO dupliquées** (Yoast + SmartCrawl) : on voit des blocs meta + JSON-LD doublés issus du clone WordPress. À nettoyer pour ne garder qu’un seul set.
   - index.html (tête) contient Yoast + SmartCrawl.
   - site-mirror/suitesmine.com/en/index.html idem.

2) **Langue incohérente sur la home ES** : og:locale et JSON‑LD `inLanguage` en en-US sur une page `lang="es-MX"`.
   - index.html

3) **URLs relatives dans OG/JSON‑LD** (ex. og:url = "/", JSON‑LD url = "/") : préférer des URLs absolues.
   - index.html
   - site-mirror/suitesmine.com/en/index.html

4) **Pas de rel=canonical** sur les pages échantillonnées : à ajouter.
   - index.html
   - site-mirror/suitesmine.com/en/index.html

5) **hreflang incomplet** : pas de `x-default`.
   - index.html
   - site-mirror/suitesmine.com/en/index.html

6) **Contenu EN avec description ES** dans JSON‑LD SmartCrawl de la home EN (reste du clone).
   - site-mirror/suitesmine.com/en/index.html

7) **Multiples H1** sur la home (ex. slider témoignages) : garder un seul H1 principal.
   - index.html

## WebP — problèmes prioritaires
1) **`og:image:type` faux** (indique image/jpeg alors que l’image est en .webp).
   - index.html
   - site-mirror/suitesmine.com/en/index.html

2) **Images externes .jpg/.png** dans OG/JSON‑LD (cozystay.loftocean.com), donc pas WebP.
   - site-mirror/suitesmine.com/en/local-activities/index.html
   - plusieurs pages similaires

3) **Placeholders .png** encore présents dans les témoignages.
   - index.html

## Recommandations concrètes (Astro)
- Centraliser les balises SEO dans un layout Astro (ex. `src/layouts/Base.astro`).
- Supprimer les blocs SEO du clone WP (Yoast/SmartCrawl) et régénérer :
  - `<title>`, `<meta name="description">`, OG, Twitter.
  - JSON‑LD unique et cohérent (WebSite + Organization + WebPage/Article).
- Forcer `canonical` + `hreflang` (inclure `x-default`).
- Normaliser `og:image:type` = `image/webp` si l’image est WebP.
- Remplacer les OG/JSON‑LD d’images externes par des assets locaux WebP.
- S’assurer d’un seul H1 par page.

Si tu veux, je peux corriger automatiquement les pages statiques présentes ici ou préparer un layout Astro propre si tu me donnes la structure `src/`.
