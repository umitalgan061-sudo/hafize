/** Owner project inventory from GitHub repository list, source titles, README and Firebase config (2026-11-24).
 * URLs are documented/configured destinations, never evidence of live health.
 * This module grants no access and performs no network or mutation. */
export const OWNER_PROJECTS = [
  {
    "id": "hafize",
    "name": "Hafize AI",
    "repository": "umitalgan061-sudo/hafize",
    "path": "public/",
    "aliases": [
      "hafize ai",
      "hafize-ua",
      "hafize-free",
      "hafize yapay zeka"
    ],
    "urls": [
      "https://hafize-ua.web.app",
      "https://hafize-free.onrender.com"
    ],
    "evidence": "Firebase workflow; Render service hafize-free; main server.ts",
    "level": "config"
  },
  {
    "id": "hafize-legacy",
    "name": "Hafize eski uygulaması",
    "repository": "umitalgan061-sudo/hafize-siteler",
    "path": "hafize-uyum/",
    "aliases": [
      "hafize eski",
      "hafize-23465",
      "hafize uyum"
    ],
    "urls": [
      "https://hafize-23465.web.app"
    ],
    "evidence": "firebase.json target hafize; sites/hafize; projelerim-8fecd also maps hafize-ua, shared target: confirm actual release source",
    "level": "config"
  },
  {
    "id": "borsa",
    "name": "Borsa Günlüğü",
    "repository": "umitalgan061-sudo/hafize-siteler",
    "path": "borsa-gunlugu/",
    "aliases": [
      "borsa gunlugu",
      "borsa-gunlugu",
      "borsa-gunlugu-ua"
    ],
    "urls": [
      "https://borsa-gunlugu.web.app",
      "https://borsa-gunlugu-ua.web.app"
    ],
    "evidence": "firebase.json target borsa; sites/borsa; projects hafize-23465 and projelerim-8fecd",
    "level": "config"
  },
  {
    "id": "etkinlik",
    "name": "Etkinlik / Tiyatro Günlüğü",
    "repository": "umitalgan061-sudo/hafize-siteler",
    "path": "etkinlik/",
    "aliases": [
      "etkinlik gunlugu",
      "tiyatro gunlugu",
      "etkinlik-gunlugu",
      "etkinlik-gunlugu-ua"
    ],
    "urls": [
      "https://etkinlik-gunlugu.web.app",
      "https://etkinlik-gunlugu-ua.web.app"
    ],
    "evidence": "firebase.json target etkinlik; sites/etkinlik; projects hafize-23465 and projelerim-8fecd",
    "level": "config"
  },
  {
    "id": "retake",
    "name": "Retake kişisel fotoğraf stüdyosu",
    "repository": "umitalgan061-sudo/retake",
    "path": ".",
    "aliases": [
      "retake",
      "retake06",
      "retake06-ua",
      "fotograf studyosu"
    ],
    "urls": [
      "https://retake06-ua.web.app",
      "https://retake06.web.app"
    ],
    "evidence": "Firebase target retake06; default projelerim-8fecd, legacy hafize-23465",
    "level": "config"
  },
  {
    "id": "westeros",
    "name": "Westeros / Yedi Krallık haritası",
    "repository": "umitalgan061-sudo/aapw",
    "path": ".",
    "aliases": [
      "westeros",
      "yedi krallik",
      "game of thrones",
      "aapw"
    ],
    "urls": [],
    "evidence": "index.html; firebase.json public .; hosting site ID not verified",
    "level": "source"
  },
  {
    "id": "tarim",
    "name": "Ankara BBB Tarımsal CBS Platformu",
    "repository": "umitalgan061-sudo/v3",
    "path": ".",
    "aliases": [
      "tarimsal cbs",
      "tarim cbs",
      "ankara bbb",
      "v3"
    ],
    "urls": [],
    "evidence": "index.html title; hosting target not verified",
    "level": "source"
  },
  {
    "id": "tiyatro",
    "name": "Tiyatro (ayrı depo)",
    "repository": "umitalgan061-sudo/Tiyatro",
    "path": ".",
    "aliases": [
      "tiyatro"
    ],
    "urls": [],
    "evidence": "repository exists; source and hosting not verified; not the same as Tiyatro Günlüğü",
    "level": "repo"
  },
  {
    "id": "ankara3d",
    "name": "Ankara 3D Haritası",
    "repository": "umitalgan061-sudo/hafize-anakara-3d",
    "path": ".",
    "aliases": [
      "ankara 3d",
      "3b ankara",
      "ankara-3d-harita",
      "hafize-anakara-3d"
    ],
    "urls": [
      "https://ankara-3d-harita.web.app"
    ],
    "evidence": "README, HAFIZE.md and index.html",
    "level": "readme"
  },
  {
    "id": "tavan",
    "name": "Ümit Tavan Arası / seyahat not defteri",
    "repository": "umitalgan061-sudo/umit-tavan-arasi",
    "path": ".",
    "aliases": [
      "tavan arasi",
      "umit-tavan-arasi",
      "seyahat not defteri"
    ],
    "urls": [
      "https://umit-tavan-arasi.web.app"
    ],
    "evidence": "README",
    "level": "readme"
  },
  {
    "id": "auto",
    "name": "Hafize otomatik güncelleme",
    "repository": "umitalgan061-sudo/hafize-otomatik-guncelleme",
    "path": ".",
    "aliases": [
      "hafize otomatik guncelleme",
      "hafize-otomatik-guncelleme"
    ],
    "urls": [
      "https://hafize-otomatik-guncelleme.web.app"
    ],
    "evidence": "README; no changes to schedules",
    "level": "readme"
  },
  {
    "id": "ankara-collector",
    "name": "Ankara Etkinlik Toplayıcı",
    "repository": "umitalgan061-sudo/ankara_etkinlik",
    "path": ".",
    "aliases": [
      "ankara etkinlik toplayici",
      "ankara_etkinlik"
    ],
    "urls": [],
    "evidence": "README; hosting unverified",
    "level": "source"
  },
  {
    "id": "ankara-events",
    "name": "Ankara Etkinlikler",
    "repository": "umitalgan061-sudo/ankara-etkinlikler",
    "path": ".",
    "aliases": [
      "ankara etkinlikler",
      "ankara-etkinlikler"
    ],
    "urls": [
      "https://ankara-etkinlikler.web.app"
    ],
    "evidence": "README",
    "level": "readme"
  },
  {
    "id": "kurum",
    "name": "Kurum Etkinlik Haritası",
    "repository": "umitalgan061-sudo/kurum-etkinlik-haritasi",
    "path": ".",
    "aliases": [
      "kurum etkinlik haritasi",
      "kurum-etkinlik-haritasi"
    ],
    "urls": [
      "https://kurum-etkinlik-haritasi.web.app"
    ],
    "evidence": "README",
    "level": "readme"
  },
  {
    "id": "weight",
    "name": "Weight-Space Harness",
    "repository": "umitalgan061-sudo/hafize-weight-space-demo",
    "path": ".",
    "aliases": [
      "weight space",
      "weight-space06",
      "hafize-weight-space-demo",
      "agirlik laboratuvari"
    ],
    "urls": [
      "https://hafize-weight-space-demo.web.app",
      "https://weight-space06.web.app"
    ],
    "evidence": "firebase.json targets hafize-weight-space-demo site-a and weight-space06 site-b; projelerim-8fecd",
    "level": "config"
  },
  {
    "id": "weight2",
    "name": "Weight-Space Demo 2",
    "repository": "umitalgan061-sudo/hafize-weight-space-demo-2",
    "path": ".",
    "aliases": [
      "weight space demo 2",
      "hafize-weight-space-demo-2"
    ],
    "urls": [
      "https://hafize-weight-space-demo-2.web.app"
    ],
    "evidence": "README",
    "level": "readme"
  }
] as const;
export const OWNER_REPOSITORIES = [...new Set(OWNER_PROJECTS.map(p => p.repository))];
function normalize(value: string): string {
  return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim();
}
/** Most specific complete alias wins; equal matches remain ambiguous. */
export function matchOwnerProjects(text: unknown) {
  if (typeof text !== 'string' || text.length > 24000) return [];
  const haystack = ' ' + normalize(text) + ' ';
  const hits = OWNER_PROJECTS.flatMap(p => {
    const aliases = [...p.aliases, ...p.urls.map(u=>new URL(u).hostname)];
    const score = Math.max(0,...aliases.map(a=>{const n=normalize(a);return n && haystack.includes(' '+n+' ') ? n.length : 0;}));
    return score ? [{project:p,score}] : [];
  });
  const max = Math.max(0,...hits.map(h=>h.score));
  return hits.filter(h=>h.score===max).map(h=>h.project);
}
