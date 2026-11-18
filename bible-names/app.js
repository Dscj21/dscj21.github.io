const app = document.getElementById('app');
const sheetEl = document.getElementById('sheet');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortEn = e => (e.en || '').split(' (')[0];
const shortHi = e => (e.hi || '').split(' (')[0];
const isGk = e => (e.s || '')[0] === 'G';
const origCls = e => isGk(e) ? 'gk' : 'heb';
const CACHE_V = '?v=11';
const people = () => D.filter(e => e.t === 'p');
const places = () => D.filter(e => e.t === 'l');
const uniq = arr => [...new Set((arr || []).filter(Boolean))];
const asArr = v => !v ? [] : (Array.isArray(v) ? v.filter(Boolean) : [v]);
function rid(id) {
  if (!id) return '';
  const s = String(id);
  return ALIAS[s] || ALIAS[s.toLowerCase()] || s;
}
function rec(id) { return id ? M[rid(id)] : undefined; }
function isGodId(id) {
  const s = String(id || '');
  return s.startsWith('god_') || s.startsWith('yahweh_') || (rec(id) && rec(id).g === 'd');
}
function kidsOf(id) {
  id = rid(id);
  const person = rec(id);
  if (!person) return [];
  return asArr(person.children).map(rid).map(rec).filter(Boolean);
}
function coParents(id) {
  id = rid(id);
  const e = rec(id);
  if (!e) return [];
  return uniq(asArr(e.spouse).map(rid)).filter(x => rec(x) && !isGodId(x));
}
function kidsWith(id, other) {
  id = rid(id); other = rid(other);
  return kidsOf(id).filter(k => asArr(k.father).map(rid).includes(other) || asArr(k.mother).map(rid).includes(other));
}
function fullSiblings(id) {
  id = rid(id);
  const e = rec(id);
  if (!e) return [];
  return asArr(e.siblings).map(rid).filter(x => x !== id && rec(x));
}
function normalize(e) {
  e.father = asArr(e.father).filter(x => !isGodId(x));
  e.mother = asArr(e.mother).filter(x => !isGodId(x));
  e.spouse = asArr(e.spouse);
  e.children = asArr(e.children);
  e.siblings = asArr(e.siblings);
  e.aka = e.aka || [];
  return e;
}
function chips(ids) {
  return `<div class="flex flex-wrap gap-2">${ids.map(id => rec(id) ? `<a href="#p/${rec(id).id}" class="px-3 py-1.5 rounded-full bg-surface-container text-on-surface font-label-md text-label-md no-underline">${esc(rec(id).hi)}</a>` : '').join('')}</div>`;
}
const letterOf = e => shortEn(e).charAt(0).toUpperCase();
function genderIcon(g) {
  if (g === 'f') return `<span class="g-icon g-f" title="Female" aria-label="Female"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="9" r="5"/><path d="M12 14v8M9 19h6"/></svg></span>`;
  if (g === 'm') return `<span class="g-icon g-m" title="Male" aria-label="Male"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="10" cy="14" r="5"/><path d="M14 10l6-6M15 4h5v5"/></svg></span>`;
  if (g === 'd') return `<span class="g-icon g-d" title="Divine" aria-label="Divine">✦</span>`;
  return '';
}
const women = () => people().filter(e => e.g === 'f');


let D = [], M = {}, INDEX = [], ALIAS = {}, FAM = {}, GEO = null, STATS = {};
let chunkLoaded = {};
let q = '', chip = 'all', letter = '';
let speakLang = 'hi';
let fav = new Set(JSON.parse(localStorage.getItem('hn-fav') || '[]'));
let mapObj = null;
let mapCluster = null;
let C = {};
let listLimit = 40;
let TREE_EXPAND = new Set();
let TREE_ROOT = '';
let mapQuery = '';

const POPULAR = ['jesus', 'david', 'abraham', 'mary', 'moses', 'noah'];
const TREES = [
  { id: 'adam', label: 'Adam' },
  { id: 'noah', label: 'Noah' },
  { id: 'abraham', label: 'Abraham' },
  { id: 'isaac', label: 'Isaac' },
  { id: 'jacob', label: 'Jacob' },
  { id: 'moses', label: 'Moses' },
  { id: 'david', label: 'David' },
  { id: 'jesus', label: 'Jesus' }
];
const JOURNEY_LAB = { abraham: 'Abraham', exodus: 'Exodus', jacob: 'Jacob', jesus: 'Jesus', paul1: 'Paul 1', paul2: 'Paul 2', paul3: 'Paul 3', paulrome: 'Rome', paul: 'Paul' };
const THOUGHT = {
  ref: 'मत्ती 18:20',
  hi: 'क्योंकि जहाँ दो या तीन मेरे नाम पर इकट्ठे होते हैं वहाँ मैं उनके बीच में होता हूँ।',
  tag: 'Divine Presence'
};

function saveFav() { localStorage.setItem('hn-fav', JSON.stringify([...fav])); }

function dayEntry() {
  const pool = people().filter(e => e.hv);
  if (!pool.length) return D[0];
  return pool[Math.floor(Date.now() / 864e5) % pool.length];
}
function letterOfEntry(e) {
  const s = (e.en || '').replace(/[^A-Za-z]/g, '');
  return (s.charAt(0) || 'A').toUpperCase();
}
async function loadChunk(letter) {
  const L = (letter || 'A').toUpperCase();
  if (chunkLoaded[L]) return;
  chunkLoaded[L] = 'loading';
  const items = await fetch('data/chunks/' + L + '.json' + CACHE_V).then(r => {
    if (!r.ok) throw new Error('chunk ' + L);
    return r.json();
  });
  items.forEach(d => {
    const cur = M[d.id] || {};
    M[d.id] = normalize(Object.assign({}, cur, d, {
      father: d.father != null ? d.father : cur.father,
      mother: d.mother != null ? d.mother : cur.mother,
      spouse: d.spouse != null ? d.spouse : cur.spouse,
      children: d.children != null ? d.children : cur.children,
      siblings: d.siblings != null ? d.siblings : cur.siblings,
      _full: true
    }));
    const al = M[d.id].alias;
    if (al && !M[al]) M[al] = M[d.id];
  });
  chunkLoaded[L] = true;
}
async function loadDetail(id) {
  id = rid(id);
  const e = rec(id);
  if (!e) return null;
  if (e._full) return e;
  try { await loadChunk(letterOfEntry(e)); } catch (err) { console.warn(err); }
  return rec(id) || e;
}
async function ensureGeo() {
  if (GEO) return GEO;
  GEO = await fetch('data/geo.json' + CACHE_V).then(r => r.json());
  GEO.forEach(g => {
    if (M[g.id]) { M[g.id].ll = g.ll; if (!M[g.id].hi) M[g.id].hi = g.hi; }
  });
  return GEO;
}
function hvBadge(e) {
  return e && e.hv === false ? '<span class="hv-badge">Unverified Hindi</span>' : '';
}
function meaningNote(e) {
  if (!e || !e.m) return '';
  return '<p class="font-label-sm text-on-surface-variant mt-1">From public-domain sources (Hitchcock, Easton, Smith, Strong’s). Marked संभवतः if the sources disagree or the sense is uncertain.</p>';
}
function paged(list) {
  const n = list.length;
  const slice = list.slice(0, listLimit);
  const more = n > listLimit
    ? `<button type="button" class="list-more" id="listMore">Show more (${n - listLimit} left of ${n})</button>`
    : '';
  return { slice, more, n };
}
function bindMore() {
  const btn = document.getElementById('listMore');
  if (!btn) return;
  btn.onclick = () => { listLimit += 40; route(); };
}

const MAP_ATTR = 'Tiles © Esri · © OpenStreetMap contributors';
function mapTile(lat, lon, z) {
  z = z || 11;
  const n = 2 ** z;
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
}
function addBaseMap(map) {
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: MAP_ATTR, maxZoom: 16, maxNativeZoom: 16
  }).addTo(map);
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 10, maxNativeZoom: 10, opacity: 0.9
  }).addTo(map);
}
function bearing(a, b) {
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function addArrows(map, latlngs) {
  for (let i = 0; i < latlngs.length - 1; i++) {
    const a = latlngs[i], b = latlngs[i + 1];
    const mid = [a[0] + (b[0] - a[0]) * 0.45, a[1] + (b[1] - a[1]) * 0.45];
    if (latlngs.some(p => Math.hypot(p[0] - mid[0], p[1] - mid[1]) < 1)) continue;
    const ang = bearing(a, b);
    const icon = L.divIcon({
      className: 'route-arrow',
      html: `<div style="transform:rotate(${ang}deg)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    L.marker(mid, { icon, interactive: false, keyboard: false, zIndexOffset: 200 }).addTo(map);
  }
}
function shortMapName(s) {
  let t = String(s || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const aliases = {
    'पिसीदिया का अन्ताकिया': 'पिसीदिया',
    'Antioch of Pisidia': 'Pisidia',
    'Goshen / Rameses': 'Goshen',
    'Salamis, Cyprus': 'Salamis',
    'मोआब के मैदान': 'मोआब',
    'Plains of Moab': 'Moab',
    'सीन का जंगल': 'सीन',
    'Wilderness of Sin': 'Sin',
    'समुद्र पार': 'समुद्र पार',
    'Sea crossing': 'Sea crossing'
  };
  return aliases[t] || t;
}
const LABEL_SIDES = ['right','left','top','bottom','top-right','top-left','bottom-right','bottom-left'];
function rectsOverlap(a, b, pad) {
  pad = pad || 3;
  return !(a.right + pad <= b.left || b.right + pad <= a.left || a.bottom + pad <= b.top || b.bottom + pad <= a.top);
}
function labelSides(stops) {
  const sides = stops.map((_, i) => (i % 2 ? 'left' : 'right'));
  const dist = (a, b) => Math.hypot(a.ll[0] - b.ll[0], a.ll[1] - b.ll[1]);
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      if (dist(stops[i], stops[j]) < 1.2) {
        if (stops[i].ll[0] >= stops[j].ll[0]) { sides[i] = 'top'; sides[j] = 'bottom'; }
        else { sides[i] = 'bottom'; sides[j] = 'top'; }
      }
    }
  }
  return sides;
}
function resolveLabels(map, items) {
  const box = map.getContainer().getBoundingClientRect();
  const inset = 2;
  const inMap = r => r.left >= box.left + inset && r.right <= box.right - inset && r.top >= box.top + inset && r.bottom <= box.bottom - inset;
  const measure = () => items.map(it => {
    const el = it.mk.getElement && it.mk.getElement();
    const lab = el && el.querySelector('.mk-lab');
    const badge = el && (el.querySelector('.mk-num, .mk-pin') || el);
    return {
      lab: lab ? lab.getBoundingClientRect() : null,
      badge: badge ? badge.getBoundingClientRect() : null
    };
  });
  const conflicts = (i, rects) => {
    const r = rects[i] && rects[i].lab;
    if (!r) return true;
    if (!inMap(r)) return true;
    for (let j = 0; j < rects.length; j++) {
      if (j === i) continue;
      if (rects[j].lab && rectsOverlap(r, rects[j].lab)) return true;
      if (rects[j].badge && rectsOverlap(r, rects[j].badge, 2)) return true;
    }
    return false;
  };
  const apply = i => {
    const it = items[i];
    it.mk.setIcon(placeDivIcon({ num: it.num, hi: it.hi, en: it.en, side: it.side, labeled: it.labeled, compact: it.compact }));
  };
  for (let pass = 0; pass < 8; pass++) {
    let rects = measure();
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].labeled === false) continue;
      if (!conflicts(i, rects)) continue;
      const start = items[i].side;
      for (const s of LABEL_SIDES) {
        if (s === start) continue;
        items[i].side = s;
        apply(i);
        rects = measure();
        if (!conflicts(i, rects)) { moved = true; break; }
      }
      if (conflicts(i, rects) && !items[i].compact) {
        items[i].compact = true;
        apply(i);
        rects = measure();
        if (!conflicts(i, rects)) moved = true;
        else {
          for (const s of LABEL_SIDES) {
            items[i].side = s;
            apply(i);
            rects = measure();
            if (!conflicts(i, rects)) { moved = true; break; }
          }
        }
      }
      if (conflicts(i, rects)) { items[i].side = start; apply(i); }
    }
    if (!moved) break;
  }
}
function placeDivIcon({ num, hi, en, side, labeled, compact }) {
  const badge = num != null ? `<span class="mk-num">${num}</span>` : `<span class="mk-pin"></span>`;
  const lab = labeled === false ? '' : `<div class="mk-lab${compact ? ' wrap' : ''}"><b>${esc(hi)}</b><span>${esc(en)}</span></div>`;
  return L.divIcon({
    className: 'bn-marker',
    html: `<div class="mk lab-${side || 'right'}">${badge}${lab}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16]
  });
}

function speak(e, lang, btn) {
  const mode = lang || speakLang;
  const text = mode === 'en' ? shortEn(e) : shortHi(e);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = mode === 'en' ? 'en-US' : 'hi-IN';
  const prefix = u.lang.slice(0, 2);
  const v = speechSynthesis.getVoices().find(x => (x.lang || '').startsWith(prefix));
  if (v) u.voice = v;
  speechSynthesis.cancel();
  const waves = btn ? btn.querySelectorAll('.eq-bar') : [];
  const icon = btn ? btn.querySelector('[data-icon]') : null;
  waves.forEach(w => w.classList.add('play'));
  if (icon) icon.textContent = 'pause';
  const stop = () => { waves.forEach(w => w.classList.remove('play')); if (icon) icon.textContent = 'volume_up'; };
  u.onend = stop; u.onerror = stop;
  speechSynthesis.speak(u);
}

function shareText(e) {
  return `${e.hi} (${shortEn(e)})\nमूल: ${e.o} – ${e.pr}\nअर्थ: ${e.m}\n${e.ref}: ${e.v}\n\n${location.href.split('#')[0]}#p/${e.id}`;
}

function doShare(e) {
  const text = shareText(e);
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else navigator.clipboard.writeText(text).then(() => toast('Copied'));
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] bg-inverse-surface text-inverse-on-surface text-sm px-4 py-2 rounded-full shadow-lg';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

function openSheet(html) {
  if (window.Ads && Ads.suspend) Ads.suspend();
  sheetEl.classList.remove('hidden');
  sheetEl.querySelector('.sheet-card').innerHTML = html;
  sheetEl.querySelector('.sheet-bg').onclick = closeSheet;
}
function closeSheet() { sheetEl.classList.add('hidden'); if (window.Ads && Ads.resume) Ads.resume(); }

function verseSheet(e) {
  openSheet(`
    <button class="text-primary font-label-md mb-2" onclick="closeSheet()">Close</button>
    <div class="font-label-sm uppercase tracking-wider text-tertiary font-semibold mb-1">Scripture</div>
    <div class="font-headline-sm text-headline-sm text-primary mb-2">${esc(e.ref)}</div>
    <p class="font-body-lg text-body-lg leading-relaxed">${esc(e.v)}</p>
    <button class="mt-4 text-primary font-label-md font-semibold" onclick="closeSheet();location.hash='p/${esc(e.id)}'">View name →</button>`);
}


const YT_CHANNELS = [
  ['https://www.youtube.com/@BlueSparrowSpiritual', 'Watch on YouTube', 'Blue Sparrow Spiritual', 'ytm'],
  ['https://www.youtube.com/@BlueSparrowKids', 'For Kids', 'Blue Sparrow Kids', 'ytk']
];
function chHandle(u) { return (String(u).match(/@[\w.-]+/) || [''])[0]; }
function openExt(url) {
  if (!url) return;
  const L = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppLauncher;
  if (L && L.openUrl) L.openUrl({ url }).catch(() => window.open(url, '_blank', 'noopener'));
  else window.open(url, '_blank', 'noopener');
}
function channelsHTML() {
  return `<div class="chlist">${YT_CHANNELS.map(([u, title, sub, cls]) =>
    `<button type="button" class="chcard ${cls}" data-yt="${esc(u)}">
      <span class="yi" aria-hidden="true"><span class="material-symbols-outlined">play_arrow</span></span>
      <span class="m"><b>${esc(title)}</b><small>${esc(sub)}</small><em>${esc(chHandle(u))}</em></span>
      <span class="material-symbols-outlined ch-chev">chevron_right</span>
    </button>`).join('')}</div>`;
}
function channelsSection() {
  return `<section class="flex flex-col gap-3 yt-channels">
    <div class="px-1"><h3 class="font-headline-sm text-headline-sm font-semibold">Our channels</h3></div>
    ${channelsHTML()}
  </section>`;
}

function aboutSheet() {
  const a = (C && C.attribution) || {};
  const nP = (STATS && STATS.people) || people().length;
  const nL = (STATS && STATS.places) || places().length;
  const pPct = STATS && STATS.peopleHindiPct != null ? STATS.peopleHindiPct : '';
  const lPct = STATS && STATS.placesHindiPct != null ? STATS.placesHindiPct : '';
  const cov = (pPct !== '' ? ` ${pPct}% of people and ${lPct}% of places have a verified IRV Hindi spelling.` : '');
  openSheet(`
    <button class="text-primary font-label-md mb-2" onclick="closeSheet()">Close</button>
    <h2 class="font-headline-md text-headline-md text-primary mb-2">Holy Names</h2>
    <p class="font-body-md text-body-md text-on-surface-variant">A lexicon of Bible names and places for Hindi-speaking Christians. Each entry shows the IRV Hindi spelling when we could verify it, the original Hebrew or Greek, a Devanagari pronunciation, and a simple Hindi meaning.</p>
    <p class="font-body-sm text-body-sm text-on-surface-variant mt-3">${nP} people · ${nL} places.${cov}</p>
    <h3 class="font-headline-sm text-primary mt-4 mb-1">Sources</h3>
    <p class="font-body-sm text-on-surface-variant">${esc(a.theographic || 'People, family relationships, and places (including many coordinates) are from Theographic Bible Metadata (CC BY-SA 4.0).')}</p>
    <p class="font-body-sm text-on-surface-variant mt-2">${esc(a.openbible || 'Some coordinates also draw on OpenBible.info Bible geocoding (CC BY).')}</p>
    <p class="font-body-sm text-on-surface-variant mt-2">${esc(a.irv || 'Hindi names and verses are from the IRV Hindi Bible. Names we could not match confidently are marked unverified and shown in English.')}</p>
    <p class="font-body-sm text-on-surface-variant mt-2">${esc(a.strongs || 'Short meanings for unmatched entries come from the public-domain Strong’s lexicon.')}</p>
    <p class="mt-4 mb-1"><a href="privacy.html" class="font-label-md text-primary font-semibold no-underline">Privacy Policy</a></p>
    <div class="gt-yt font-label-sm font-semibold mt-4 mb-2">Our channels</div>
    ${channelsHTML()}`);
}

function setNav(path) {
  const labels = { home: 'Home', people: 'People', lineage: 'Lineage', map: 'Map', more: 'More', saved: 'Saved', detail: 'Name', finder: 'Name finder', quiz: 'Quiz', timeline: 'Timeline', genealogy: 'Genealogy', gods: 'Names of God', women: 'Women', card: 'Name card' };
  const morePages = ['more','finder','quiz','timeline','genealogy','gods','women','card'];
  document.getElementById('hdrSub').textContent = '• ' + (labels[path] || 'Home');
  document.querySelectorAll('.nav-tab').forEach(a => {
    const tab = morePages.includes(path) ? 'more' : (path === 'detail' ? '' : path);
    a.classList.toggle('on', a.dataset.path === tab);
  });
}

function waves() {
  return `<div class="flex items-end gap-0.5 h-4 ml-1 pr-1.5" aria-hidden="true">
    <span class="eq-bar h-2"></span><span class="eq-bar h-3.5"></span>
    <span class="eq-bar h-1.5"></span><span class="eq-bar h-3"></span>
  </div>`;
}

function listenPill(e, extra = '') {
  return `<button type="button" class="flex items-center gap-3 bg-surface-container-highest px-3.5 py-2.5 rounded-full active:scale-95 transition-all hover:bg-surface-container-high group ${extra}" data-speak="${e.id}">
    <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center flex-shrink-0 shadow-sm">
      <span class="material-symbols-outlined text-[18px]" data-icon>volume_up</span>
    </div>
    <div class="flex flex-col text-left">
      <span class="font-label-sm text-label-sm text-on-surface font-semibold leading-none">Listen Pronunciation</span>
      <span class="font-label-sm text-[10px] text-on-surface-variant mt-0.5">${esc(shortHi(e))} · ${esc(shortEn(e))}</span>
    </div>
    ${waves()}
  </button>`;
}

function nameCard(e) {
  return `<article class="bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col justify-between gap-3 hover:bg-surface-container transition-colors cursor-pointer" data-open="${e.id}">
    <div class="flex justify-between items-start">
      <div>
        <div class="flex items-baseline gap-2 flex-wrap">
          <h4 class="font-headline-sm text-headline-sm font-bold text-on-surface inline-flex items-center gap-1.5">${genderIcon(e.g)} ${esc(e.hi)}</h4>
          <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">(${esc(shortEn(e))})</span>
          ${hvBadge(e)}
        </div>
        ${e.o ? `<div class="text-[18px] leading-tight text-primary font-semibold mt-0.5 ${origCls(e)}">${esc(e.o)}</div>` : ''}
      </div>
      <button type="button" aria-label="Pronunciation" class="w-8 h-8 rounded-full bg-surface-container-highest text-primary flex items-center justify-center hover:bg-primary-container hover:text-on-primary transition-all active:scale-95 shadow-sm flex-shrink-0" data-speak="${e.id}">
        <span class="material-symbols-outlined text-[18px]">volume_up</span>
      </button>
    </div>
    <div class="flex flex-col gap-1.5 pt-1">
      ${e.m ? `<div class="flex items-start gap-1.5 text-on-surface-variant font-body-sm text-body-sm">
        <span class="material-symbols-outlined text-tertiary text-[16px] mt-0.5">menu_book</span>
        <span>Meaning: <strong class="text-on-surface font-semibold">“${esc(e.m)}”</strong></span>
      </div>` : ''}
      <div class="flex items-center gap-2 flex-wrap">
        ${e.ref ? `<button type="button" class="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-medium" data-verse="${e.id}">${esc(e.ref)}</button>` : ''}
        ${e.s ? `<span class="text-on-surface-variant font-label-sm text-label-sm">${esc(e.s)}</span>` : ''}
      </div>
    </div>
  </article>`;
}

function placeCard(e) {
  const ll = e.ll;
  const bg = ll ? `background-image:url('${mapTile(ll[0], ll[1], 12)}')` : 'background:#5c623b';
  return `<article class="bg-surface-container-low rounded-xl overflow-hidden shadow-sm flex flex-col cursor-pointer" data-open="${e.id}">
    <div class="place-hero w-full" style="${bg}">
      <div class="absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-inverse-surface/30 to-transparent"></div>
      <div class="absolute bottom-2.5 left-3 right-3 text-inverse-on-surface">
        <div class="flex items-baseline gap-2 flex-wrap">
          <span class="font-headline-sm text-headline-sm font-bold text-surface-container-lowest">${esc(e.hi)}</span>
          <span class="font-label-sm text-label-sm opacity-90">(${esc(shortEn(e))})</span>
          ${hvBadge(e)}
          ${e.o ? `<span class="font-body-sm text-body-sm font-semibold text-secondary-fixed ml-auto ${origCls(e)}">${esc(e.o)}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="p-3.5 flex flex-col gap-2">
      ${e.m ? `<div class="flex items-center justify-between text-body-sm font-body-sm gap-2">
        <span class="text-on-surface-variant font-medium">Original Literal Meaning:</span>
        <span class="font-semibold text-tertiary text-right">“${esc(e.m)}”</span>
      </div>` : ''}
      <div class="flex items-center gap-2 pt-1">
        ${e.ref ? `<button type="button" class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-medium" data-verse="${e.id}">${esc(e.ref)}</button>` : ''}
        ${e.pr ? `<span class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-medium">${esc(e.pr)}</span>` : ''}
        ${e.ft ? `<span class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-medium">${esc(e.ft)}</span>` : ''}
      </div>
    </div>
  </article>`;
}

function searchBox(placeholder) {
  return `<div class="relative flex items-center w-full bg-surface-container rounded-full shadow-sm">
    <span class="material-symbols-outlined absolute left-4 text-on-surface-variant text-[22px]">search</span>
    <input id="q" class="w-full bg-transparent py-3.5 pl-12 pr-24 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none" placeholder="${esc(placeholder)}" type="search" value="${esc(q)}"/>
    <div class="absolute right-2 flex items-center gap-1">
      <button type="button" aria-label="Voice search" id="btnMic" class="w-9 h-9 flex items-center justify-center rounded-full text-primary hover:bg-surface-container-high transition-colors active:scale-95">
        <span class="material-symbols-outlined text-[20px]">mic</span>
      </button>
    </div>
  </div>`;
}

function chipsBar() {
  const items = [
    ['all', 'stars', 'All'],
    ['p', 'person', 'People'],
    ['l', 'location_on', 'Places'],
    ['m', 'translate', 'Meanings']
  ];
  return `<div class="flex items-center gap-space-xs overflow-x-auto no-scrollbar py-1">
    ${items.map(([k, ic, lab]) => {
      const on = chip === k;
      return `<button type="button" data-chip="${k}" class="flex items-center gap-1.5 ${on ? 'px-4 py-2 bg-primary text-on-primary shadow-sm' : 'px-3.5 py-2 bg-surface-container text-on-surface-variant hover:text-on-surface'} rounded-full font-label-md text-label-md font-medium flex-shrink-0 active:scale-95 transition-transform">
        <span class="material-symbols-outlined text-[16px]">${ic}</span><span>${lab}</span>
      </button>`;
    }).join('')}
  </div>`;
}

function alphaStrip(list) {
  const have = [...new Set(list.map(letterOf).filter(c => /[A-Z]/.test(c)))].sort();
  return `<section class="flex flex-col gap-2">
    <div class="flex items-center justify-between px-1">
      <h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold">Alphabetical Index</h3>
      <span class="font-label-sm text-label-sm text-tertiary font-medium">A to Z</span>
    </div>
    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5">
      ${have.map(c => {
        const on = letter === c;
        return `<button type="button" data-letter="${c}" class="w-10 h-10 rounded-full ${on ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'} font-headline-sm text-headline-sm flex items-center justify-center flex-shrink-0 transition-colors">${c}</button>`;
      }).join('')}
    </div>
  </section>`;
}

function matchQuery(e, t) {
  if (!t) return true;
  const hay = [e.hi, e.en, e.pr, e.m, e.o, e.s, e.ref, e.alias, ...(e.aka || [])].join(' ').toLowerCase();
  return hay.includes(t);
}

function filtered(base) {
  let list = base;
  if (chip === 'p') list = list.filter(e => e.t === 'p');
  if (chip === 'l') list = list.filter(e => e.t === 'l');
  const t = q.trim().toLowerCase();
  list = list.filter(e => matchQuery(e, t));
  if (letter) list = list.filter(e => letterOf(e) === letter);
  return list;
}

function home() {
  setNav('home');
  const day = dayEntry();
  const searching = !!(q.trim() || letter || (chip !== 'all'));
  const results = filtered(D);
  const pop = POPULAR.map(id => M[id]).filter(Boolean);
  const topPlaces = ['jerusalem', 'bethlehem'].map(id => M[id]).filter(Boolean);

  let body = '';
  if (searching) {
    const title = chip === 'm' ? 'Meanings' : letter ? `Names · ${letter}` : 'Results';
    body = `<section class="flex flex-col gap-3">
      <h3 class="font-headline-sm text-headline-sm px-1">${title} <span class="text-on-surface-variant font-label-sm">${results.length}</span></h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${paged(results).slice.map(chip === 'l' ? placeCard : nameCard).join('') || '<p class="text-on-surface-variant px-1">No match</p>'}</div>
      ${paged(results).more}
    </section>`;
  } else {
    body = `
      ${alphaStrip(D)}
      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[20px]">badge</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold">Popular Biblical Names</h3>
          </div>
          <a class="font-label-sm text-label-sm text-primary font-semibold hover:underline" href="#people">View all (${people().length})</a>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${pop.map(nameCard).join('')}</div>
      </section>
      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[20px]">explore</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold">Holy Places &amp; Cities</h3>
          </div>
          <a class="font-label-sm text-label-sm text-primary font-semibold hover:underline" href="#map">View Map</a>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">${topPlaces.map(placeCard).join('')}</div>
      </section>
      <section class="relative overflow-hidden bg-secondary-container/40 rounded-xl p-4 shadow-sm flex gap-3.5 items-start">
        <div class="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
          <span class="material-symbols-outlined text-[20px]">format_quote</span>
        </div>
        <div class="flex flex-col gap-1 min-w-0">
          <span class="font-label-sm text-label-sm text-on-secondary-fixed-variant font-bold tracking-wide uppercase">Daily Spiritual Thought</span>
          <p class="font-headline-sm text-headline-sm text-on-surface font-semibold italic leading-snug">“${esc(THOUGHT.hi)}”</p>
          <div class="flex items-center gap-2 mt-1">
            <span class="font-label-md text-label-md font-bold text-primary">— ${esc(THOUGHT.ref)}</span>
            <span class="text-on-surface-variant font-label-sm text-label-sm">• ${esc(THOUGHT.tag)}</span>
          </div>
        </div>
      </section>
      ${exploreTiles()}
      ${channelsSection()}`;
  }

  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-lg">
    <section class="flex flex-col gap-space-sm pt-space-xs">
      ${searchBox('Search in Hindi or English…')}
      ${chipsBar()}
    </section>
    ${searching ? '' : `<section class="flex flex-col gap-space-xs">
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <span class="flex h-2.5 w-2.5 rounded-full bg-tertiary-container animate-pulse"></span>
          <span class="font-label-sm text-label-sm uppercase tracking-wider text-tertiary font-semibold">Daily Featured Study</span>
        </div>
        <span class="font-label-sm text-label-sm text-on-surface-variant">Holy Name of the Day</span>
      </div>
      <div class="relative overflow-hidden bg-surface-container-low rounded-xl p-5 shadow-md flex flex-col gap-4">
        <div class="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-primary-fixed/30 pointer-events-none blur-2xl"></div>
        <div class="flex justify-between items-start gap-3">
          <div class="flex flex-col min-w-0">
            <div class="flex items-baseline gap-3 flex-wrap">
              <h2 class="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary tracking-tight">${esc(day.hi)}</h2>
              <span class="text-[26px] leading-tight text-on-surface-variant ${origCls(day)}">${esc(day.o)}</span>
            </div>
            <span class="font-label-md text-label-md text-on-surface-variant mt-0.5">${esc(shortEn(day))} · Transliteration: <span class="font-semibold text-on-surface">${esc(day.pr)}</span></span>
          </div>
          <button type="button" data-verse="${day.id}" class="flex items-center px-2.5 py-1 rounded-md bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold flex-shrink-0">${esc(day.ref)}</button>
        </div>
        <div class="bg-surface-container-lowest/80 rounded-lg p-3.5 flex flex-col gap-1 shadow-sm">
          <span class="font-label-sm text-label-sm text-tertiary font-semibold flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]">lightbulb</span>
            Original Meaning
          </span>
          <p class="font-body-md text-body-md text-on-surface font-medium leading-relaxed">“${esc(day.m)}”</p>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          ${listenPill(day)}
          <a class="inline-flex items-center justify-end gap-1 font-label-md text-label-md text-primary font-semibold hover:underline" href="#p/${day.id}">
            <span>View in Detail</span>
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </a>
        </div>
      </div>
    </section>`}
    ${body}
  </div>`;
  bindSearch();
  bindClicks();
}

function listView(kind) {
  setNav(kind === 'l' ? 'map' : 'people');
  chip = kind === 'm' ? 'm' : kind;
  const list = kind === 'l' ? places() : people();
  const shown = filtered(kind === 'l' ? places() : (kind === 'm' ? D : people()));
  const page = paged(shown);
  const title = kind === 'l' ? 'Holy Places & Cities' : kind === 'm' ? 'Meanings' : 'Biblical Names';
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-lg pt-space-xs">
    ${searchBox(kind === 'l' ? 'Search places in Hindi or English…' : 'Search names in Hindi or English…')}
    ${alphaStrip(list)}
    <section class="flex flex-col gap-3">
      <h3 class="font-headline-sm text-headline-sm px-1">${title} <span class="text-on-surface-variant font-label-sm">${page.n}</span></h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${page.slice.map(kind === 'l' ? placeCard : nameCard).join('') || '<p class="text-on-surface-variant px-1">No match</p>'}</div>
      ${page.more}
    </section>
  </div>`;
  bindSearch();
  bindClicks();
  bindMore();
}

function savedView() {
  setNav('saved');
  const list = [...fav].map(id => M[id]).filter(Boolean);
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-lg pt-space-xs">
    <h2 class="font-headline-md text-headline-md text-primary">Saved names</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${list.map(nameCard).join('') || '<p class="text-on-surface-variant">Tap the bookmark on any name to save it here.</p>'}</div>
  </div>`;
  bindClicks();
}

function familyBits(e) {
  const parts = [];
  const row = (lab, ids) => {
    if (!ids.length) return;
    parts.push(`<div class="mb-2"><div class="font-label-sm text-label-sm text-on-surface-variant mb-1">${lab}</div>${chips(ids)}</div>`);
  };
  row('Father', e.father || []);
  row('Mother', e.mother || []);
  const spouses = coParents(e.id);
  row(spouses.length > 1 ? 'Spouses' : 'Spouse', spouses);
  row('Siblings', fullSiblings(e.id));
  const partners = coParents(e.id);
  const grouped = new Set();
  for (const p of partners) {
    const kids = kidsWith(e.id, p).map(k => k.id);
    kids.forEach(id => grouped.add(id));
    if (kids.length) row(`Children with ${esc(shortHi(rec(p)||{}))}`, kids);
  }
  const leftover = kidsOf(e.id).map(k => k.id).filter(id => !grouped.has(id));
  row('Children', leftover);
  if (!parts.length) return '';
  return `<section class="bg-surface-container-low rounded-xl p-4 shadow-sm">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-headline-sm text-headline-sm font-semibold">Family</h3>
      <a href="#lineage/${e.id}" class="font-label-sm text-label-sm text-primary font-semibold hover:underline">View full tree</a>
    </div>
    ${parts.join('')}
  </section>`;
}

function detail(e) {
  if (!e) return home();
  setNav('detail');
  scrollTo(0, 0);
  const saved = fav.has(e.id);
  const rootHint = isGk(e) ? 'Greek' : 'Hebrew';
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <div class="flex items-center justify-between">
      <button type="button" class="inline-flex items-center gap-1 text-primary font-label-md font-semibold" onclick="history.length>1?history.back():location.hash='home'">
        <span class="material-symbols-outlined text-[20px]">arrow_back</span> Back
      </button>
      <div class="flex items-center gap-1">
        <button type="button" id="btnFav" aria-label="Save" class="w-10 h-10 rounded-full flex items-center justify-center ${saved ? 'text-primary' : 'text-on-surface-variant'} hover:bg-surface-container">
          <span class="material-symbols-outlined text-[22px]" style="font-variation-settings:'FILL' ${saved ? 1 : 0}">bookmark</span>
        </button>
        <button type="button" id="btnShare" aria-label="Share" class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container">
          <span class="material-symbols-outlined text-[22px]">share</span>
        </button>
      </div>
    </div>

    <section class="relative overflow-hidden bg-surface-container-low rounded-xl p-5 shadow-md flex flex-col gap-4">
      <div class="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-primary-fixed/30 pointer-events-none blur-2xl"></div>
      <div class="flex justify-between items-start gap-3">
        <div>
          <div class="flex items-baseline gap-3 flex-wrap">
            <h1 class="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary tracking-tight inline-flex items-center gap-2">${genderIcon(e.g)} ${esc(e.hi)}</h1>${hvBadge(e)}
            <span class="text-[26px] leading-tight text-on-surface-variant ${origCls(e)}">${esc(e.o)}</span>
          </div>
          <div class="font-label-md text-label-md text-on-surface-variant mt-1">${esc(e.en)}</div>
        </div>
        <button type="button" data-verse="${e.id}" class="flex items-center px-2.5 py-1 rounded-md bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold flex-shrink-0">${esc(e.ref)}</button>
      </div>
      <div class="bg-surface-container-lowest/80 rounded-lg p-3.5 flex flex-col gap-1 shadow-sm">
        <span class="font-label-sm text-label-sm text-tertiary font-semibold flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]">lightbulb</span>
          Literal Meaning
        </span>
        ${e.m ? `<p class="font-body-lg text-body-lg text-on-surface font-medium leading-relaxed">“${esc(e.m)}”</p>${meaningNote(e)}` : '<p class="font-body-md text-on-surface-variant">No short meaning yet.</p>'}
        ${e.hv === false ? '<p class="font-body-sm text-on-surface-variant mt-2">Hindi spelling is unverified — we could not confidently match this name in the IRV verse text, so the English name is shown.</p>' : ''}
      </div>
    </section>

    ${e.t === 'l' || (e.pl && e.pl.length) || e.ll ? '<div id="miniMapWrap"></div>' : '<div id="miniMapWrap" hidden></div>'}

    <section class="bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col gap-3">
      <h3 class="font-headline-sm text-headline-sm font-semibold">Authentic Pronunciation</h3>
      <p class="font-body-md text-body-md text-on-surface">${esc(e.pr)}</p>
      <div class="flex items-center gap-2">
        <button type="button" data-lang="hi" class="lang-btn px-3 py-1.5 rounded-full font-label-md text-label-md ${speakLang === 'hi' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}">Hindi</button>
        <button type="button" data-lang="en" class="lang-btn px-3 py-1.5 rounded-full font-label-md text-label-md ${speakLang === 'en' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}">English</button>
      </div>
      ${listenPill(e, 'self-start')}
    </section>

    <section class="bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col gap-2">
      <h3 class="font-headline-sm text-headline-sm font-semibold">Etymology &amp; Root Analysis</h3>
      <p class="font-body-md text-body-md">Strong's <strong>${esc(e.s)}</strong> · ${rootHint} <span class="${origCls(e)} text-primary font-semibold">${esc(e.o)}</span></p>
      <p class="font-body-md text-body-md text-on-surface-variant">Pronounced <strong class="text-on-surface">${esc(e.pr)}</strong>. In the IRV Hindi Bible this name is written <strong class="text-on-surface">${esc(e.hi)}</strong>${e.m ? `. The name means “${esc(e.m)}”` : ''}.</p>
    </section>

    <section class="bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col gap-2">
      <h3 class="font-headline-sm text-headline-sm font-semibold">Historical Context</h3>
      <div class="font-label-sm text-label-sm uppercase tracking-wider text-tertiary font-semibold">First reference · ${esc(e.ref)}</div>
      <p class="font-body-lg text-body-lg leading-relaxed bg-surface-container-lowest/80 rounded-lg p-3.5">${esc(e.v)}</p>
    </section>

    ${familyBits(e)}

    <div class="flex gap-2 flex-wrap">
      <button type="button" id="btnShare2" class="flex-1 rounded-xl bg-primary text-on-primary py-3 font-label-lg font-semibold">Share</button>
      <button type="button" id="btnWa" class="flex-1 rounded-xl bg-secondary text-on-secondary py-3 font-label-lg font-semibold">WhatsApp</button>
      <button type="button" id="btnCard" class="flex-1 rounded-xl bg-tertiary-container text-on-tertiary-container py-3 font-label-lg font-semibold">Name card</button>
    </div>
  </div>`;

  bindClicks();
  document.getElementById('btnFav').onclick = () => {
    if (fav.has(e.id)) fav.delete(e.id); else fav.add(e.id);
    saveFav();
    detail(e);
  };
  document.getElementById('btnShare').onclick = () => doShare(e);
  document.getElementById('btnShare2').onclick = () => doShare(e);
  document.getElementById('btnWa').onclick = () => open('https://wa.me/?text=' + encodeURIComponent(shareText(e)));
  document.getElementById('btnCard').onclick = () => { location.hash = 'card/' + e.id; };
  app.querySelectorAll('.lang-btn').forEach(b => b.onclick = () => { speakLang = b.dataset.lang; detail(e); });
  mountMiniMap(e);
}

async function relatedPlacePoints(e) {
  await ensureGeo().catch(() => {});
  const pts = [];
  const add = p => {
    if (!p || !p.ll) return;
    if (pts.some(x => x.id === p.id)) return;
    pts.push({ id: p.id, hi: p.hi || p.en, en: p.en, ll: p.ll });
  };
  if (e.ll) add(e);
  asArr(e.pl).forEach(id => add(rec(id)));
  return pts;
}

function mountMiniMap(e) {
  const wrap = document.getElementById('miniMapWrap');
  if (!wrap) return;
  const draw = pts => {
    if (!pts.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `<section class="bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col gap-2">
      <h3 class="font-headline-sm text-headline-sm font-semibold">${e.t === 'l' ? 'Map' : 'Related places'}</h3>
      <div id="mapel" class="mini-map"></div>
    </section>`;
    const go = () => {
      if (!window.L) return setTimeout(go, 200);
      const m = L.map('mapel', { scrollWheelZoom: false });
      m.attributionControl.setPrefix('Leaflet');
      addBaseMap(m);
      pts.forEach(p => {
        const mk = L.marker(p.ll, {
          icon: placeDivIcon({ hi: shortMapName(p.hi), en: shortMapName(p.en), side: 'right' }),
          zIndexOffset: 400
        }).addTo(m).bindPopup(`<strong>${esc(p.hi)}</strong><br>${esc(p.en)}`);
        mk.on('click', () => { if (p.id !== e.id) location.hash = 'p/' + p.id; });
      });
      if (pts.length === 1) m.setView(pts[0].ll, 9);
      else m.fitBounds(pts.map(p => p.ll), { padding: [28, 28], maxZoom: 8 });
      setTimeout(() => m.invalidateSize(), 80);
    };
    go();
  };
  relatedPlacePoints(e).then(draw);
}

function treeNode(id, kind) {
  id = rid(id);
  const e = rec(id);
  if (!e) return '';
  return `<button type="button" class="tree-node ${kind || ''}" data-center="${id}">
    ${genderIcon(e.g)}
    <span class="tn-text"><span class="tn-hi">${esc(shortHi(e))}</span><span class="tn-en">${esc(shortEn(e))}</span></span>
  </button>`;
}

function coupleRow(a, b, aKind, bKind) {
  if (a && !b) return `<div class="tree-row">${treeNode(a, aKind)}</div>`;
  if (!a && b) return `<div class="tree-row">${treeNode(b, bKind)}</div>`;
  if (!a && !b) return '';
  return `<div class="tree-row"><div class="couple">${treeNode(a, aKind)}<span class="couple-heart" aria-hidden="true">♥</span>${treeNode(b, bKind || '')}</div></div>`;
}

function preferredPartners(id) {
  id = rid(id);
  const raw = coParents(id).map(rid);
  const PREFERRED = {
    abraham_58: ['sarah_2473', 'hagar_1348', 'keturah_1782'],
    israel_682: ['leah_1813', 'rachel_2386', 'bilhah_502', 'zilpah_3081'],
    david_994: ['michal_2073', 'ahinoam_153', 'abigail_26', 'maacah_1839', 'haggith_1353', 'bathsheba_416']
  };
  const pref = PREFERRED[id];
  if (!pref) return raw;
  const set = new Set(raw);
  return pref.filter(x => set.has(x)).concat(raw.filter(x => !pref.includes(x)));
}

function parentPair(id) {
  const e = rec(id);
  if (!e) return { fa: '', mo: '' };
  const fa = asArr(e.father).map(rid).find(p => rec(p) && !isGodId(p)) || '';
  const mo = asArr(e.mother).map(rid).find(p => rec(p) && !isGodId(p)) || '';
  return { fa, mo };
}

function ancestorGens(id, levels) {
  const gens = [];
  let cur = rid(id);
  const seen = new Set([cur]);
  for (let i = 0; i < (levels || 3); i++) {
    const { fa, mo } = parentPair(cur);
    if (!fa && !mo) break;
    if ((fa && seen.has(fa)) || (mo && seen.has(mo))) break;
    gens.unshift({ fa, mo });
    if (fa) seen.add(fa);
    if (mo) seen.add(mo);
    cur = fa || mo;
  }
  return gens;
}

function kidCell(k) {
  const gkids = kidsOf(k.id);
  const open = TREE_EXPAND.has(k.id);
  let html = `<div class="kid-cell">${treeNode(k.id)}`;
  if (gkids.length) {
    html += `<button type="button" class="tree-exp" data-expand="${k.id}">${open ? 'Hide' : '+' + gkids.length}</button>`;
    if (open) {
      html += `<div class="tree-line"></div><div class="tree-row gkid-row">${gkids.map(c => treeNode(c.id)).join('')}</div>`;
    }
  }
  html += `</div>`;
  return html;
}

function renderTree(rootId) {
  rootId = rid(rootId);
  const e = rec(rootId);
  if (!e) return '<p class="text-on-surface-variant">No family links for this name yet.</p>';
  const partners = preferredPartners(rootId);
  const grouped = new Set();
  partners.forEach(p => kidsWith(rootId, p).forEach(k => grouped.add(k.id)));
  const leftover = kidsOf(rootId).filter(k => !grouped.has(k.id));
  const sibs = fullSiblings(rootId);
  const ancLevels = TREE_EXPAND.has('__anc__') ? 6 : 2;
  const gens = ancestorGens(rootId, ancLevels);
  const allAnc = ancestorGens(rootId, 8);
  let html = '<div class="tree compact-tree">';
  html += '<div class="anc-col">';
  if (allAnc.length > gens.length) {
    html += `<button type="button" class="tree-exp anc-more" data-more-anc="1">Earlier ancestors</button>`;
  }
  gens.forEach(g => {
    html += coupleRow(g.fa, g.mo);
    html += '<div class="tree-line"></div>';
  });
  html += '</div>';
  if (sibs.length) {
    html += `<div class="sib-label">Siblings</div><div class="tree-row sib-row">${sibs.map(s => treeNode(s, 'sib')).join('')}</div><div class="tree-line"></div>`;
  }
  if (partners.length === 0) {
    html += `<div class="tree-row">${treeNode(rootId, 'me')}</div>`;
    if (leftover.length) {
      html += `<div class="from-joint"><div class="tree-line"></div><div class="tree-row">${leftover.map(kidCell).join('')}</div></div>`;
    }
  } else if (partners.length === 1) {
    const kids = kidsWith(rootId, partners[0]).concat(leftover);
    html += `<div class="couple-block">`;
    html += coupleRow(rootId, partners[0], 'me', '');
    if (kids.length) {
      html += `<div class="from-joint"><div class="joint-bar"></div><div class="tree-line"></div><div class="tree-row">${kids.map(kidCell).join('')}</div></div>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="union" style="--wives:${partners.length}">`;
    html += `<div class="union-spouses">`;
    html += `<div class="u-self">${treeNode(rootId, 'me')}</div>`;
    for (const p of partners) {
      html += `<div class="u-unit"><span class="couple-heart" aria-hidden="true">♥</span>${treeNode(p)}</div>`;
    }
    html += `</div>`;
    html += `<div class="union-kids">`;
    html += `<div class="u-self u-pad"></div>`;
    for (const p of partners) {
      const kids = kidsWith(rootId, p);
      html += `<div class="u-unit">`;
      if (kids.length) {
        html += `<div class="from-joint"><div class="joint-bar"></div><div class="tree-line"></div>`;
        html += `<div class="wife-kids">${kids.map(kidCell).join('')}</div></div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    if (leftover.length) {
      html += `<div class="leftover-kids">${leftover.map(kidCell).join('')}</div>`;
    }
    html += `</div>`;
  }
  html += '</div>';
  return html;
}

function lineageView(rootId) {
  setNav('lineage');
  const resolved = rid(rootId);
  if (TREE_ROOT && rid(TREE_ROOT) !== resolved) TREE_EXPAND = new Set();
  const root = (resolved && rec(resolved)) ? resolved : rid('abraham');
  TREE_ROOT = root;
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <div class="px-1">
      <h2 class="font-headline-md text-headline-md text-primary">Biblical Family Tree</h2>
      <p class="font-body-sm text-body-sm text-on-surface-variant">Ancestors are above. The person and spouses share one row (♥). Children appear under their own mother. Tap a name to re-centre the tree, or + to show grandchildren.</p>
    </div>
    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
      ${TREES.map(t => `<button type="button" data-tree="${t.id}" class="flex-shrink-0 px-3.5 py-2 rounded-full font-label-md text-label-md ${t.id === root ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'}">${esc(M[t.id] ? M[t.id].hi : t.label)}</button>`).join('')}
    </div>
    <section class="bg-surface-container-low rounded-xl p-3 shadow-sm">
      <div class="tree-scroll-wrap">
        <div class="tree-scroll">${renderTree(root)}</div>
      </div>
      <p class="tree-scroll-note font-label-sm" hidden>Swipe sideways to see every branch →</p>
    </section>
  </div>`;
  app.querySelectorAll('[data-tree]').forEach(b => b.onclick = () => { location.hash = 'lineage/' + b.dataset.tree; });
  const sc = app.querySelector('.tree-scroll');
  const wrap = app.querySelector('.tree-scroll-wrap');
  const note = app.querySelector('.tree-scroll-note');
  if (sc && wrap) {
    const updateHint = () => {
      const overflow = sc.scrollWidth > sc.clientWidth + 4;
      wrap.classList.toggle('can-scroll', overflow);
      wrap.classList.toggle('at-end', sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 4);
      if (note) note.hidden = !overflow;
    };
    sc.addEventListener('scroll', updateHint, { passive: true });
    requestAnimationFrame(updateHint);
    setTimeout(updateHint, 50);
  }
  app.querySelectorAll('[data-center]').forEach(b => b.onclick = () => {
    const id = b.dataset.center;
    if (!id) return;
    if (rid(id) === rid(TREE_ROOT) && rec(id)) { location.hash = 'p/' + rec(id).id; return; }
    TREE_EXPAND = new Set();
    location.hash = 'lineage/' + id;
  });
  app.querySelectorAll('[data-expand]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const id = b.dataset.expand;
    if (TREE_EXPAND.has(id)) TREE_EXPAND.delete(id); else TREE_EXPAND.add(id);
    lineageView(TREE_ROOT);
  });
  const moreAnc = app.querySelector('[data-more-anc]');
  if (moreAnc) moreAnc.onclick = ev => {
    ev.stopPropagation();
    if (TREE_EXPAND.has('__anc__')) TREE_EXPAND.delete('__anc__'); else TREE_EXPAND.add('__anc__');
    lineageView(TREE_ROOT);
  };
}

function mapView(journeyId) {
  setNav('map');
  const journeys = C.journeys || [];
  const j = journeys.find(x => x.id === journeyId);
  const tabs = [['', 'Places']].concat(journeys.map(x => [x.id, JOURNEY_LAB[x.id] || x.title || x.id]));
  const geo = GEO || [];
  const mq = (mapQuery || '').trim().toLowerCase();
  const matched = mq ? geo.filter(e => matchQuery(e, mq)) : geo;
  const page = paged(matched.map(g => rec(g.id) || g).filter(Boolean));
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <h2 class="font-headline-md text-headline-md text-primary">${j ? esc(j.hi) : 'Holy Places &amp; Cities'}</h2>
    <div class="flex gap-2 overflow-x-auto no-scrollbar">${tabs.map(([id,lab]) => `<a href="${id?'#map/'+id:'#map'}" class="flex-shrink-0 px-3.5 py-2 rounded-full font-label-md no-underline ${(!j && !id) || (j && j.id===id)?'bg-primary text-on-primary':'bg-surface-container text-on-surface-variant'}">${esc(lab)}</a>`).join('')}</div>
    ${j ? (j.note ? `<p class="font-body-sm text-on-surface-variant">${esc(j.note)}</p>` : (j.approx ? '<p class="font-body-sm text-on-surface-variant">Approximate / traditional route. The exact path is debated.</p>' : '')) : searchBox('Search places…')}
    <div id="mapel" class="map-lg shadow-sm"></div>
    <div class="map-legend" id="mapLegend"></div>
    <div id="placeInfo"></div>
    ${j ? `<ol class="font-body-md list-decimal ps-5">${j.stops.map(s=>`<li class="mb-1"><strong>${esc(s.hi)}</strong> <span class="text-on-surface-variant">(${esc(s.n)})</span></li>`).join('')}</ol>` : `<p class="font-label-sm text-on-surface-variant px-1">${matched.length} places with map coordinates</p><div class="grid grid-cols-1 gap-3.5">${page.slice.map(placeCard).join('')}</div>${page.more}`}
  </div>`;
  if (!j) {
    const box = app.querySelector('#q');
    if (box) box.value = mapQuery;
    bindSearch();
    const qi = document.getElementById('q');
    if (qi) {
      qi.oninput = ev => { mapQuery = ev.target.value; listLimit = 40; /* don't rerender whole map on each key — filter on enter/search bind */ };
    }
    bindClicks();
    bindMore();
  }
  const go = () => {
    if (!window.L) return setTimeout(go, 200);
    if (mapObj) { try { mapObj.remove(); } catch (err) {} mapObj = null; mapCluster = null; }
    const el = document.getElementById('mapel');
    if (!el) return;
    const m = L.map('mapel', { scrollWheelZoom: true });
    m.attributionControl.setPrefix('Leaflet');
    addBaseMap(m);
    mapObj = m;
    const legend = document.getElementById('mapLegend');
    if (j) {
      const latlngs = j.stops.map(s => s.ll);
      const line = L.polyline(latlngs, { color: '#9e432a', weight: 4, opacity: 0.9 }).addTo(m);
      addArrows(m, latlngs);
      const sides = labelSides(j.stops);
      const stopMarks = j.stops.map((s, i) => {
        const hi = shortMapName(s.hi), en = shortMapName(s.n);
        const mk = L.marker(s.ll, {
          icon: placeDivIcon({ num: i + 1, hi, en, side: sides[i] }),
          zIndexOffset: 400 + i
        }).addTo(m).bindPopup(`<strong>${i + 1}. ${esc(s.hi)}</strong><br>${esc(s.n)}`);
        if (s.id) mk.on('click', () => { /* popup only */ });
        return { mk, ll: s.ll, num: i + 1, hi, en, side: sides[i] };
      });
      m.fitBounds(line.getBounds(), { padding: [40, 48] });
      const layoutStops = () => {
        const pts = stopMarks.map(it => m.latLngToLayerPoint(it.ll));
        for (let i = 0; i < pts.length; i++) {
          for (let k = i + 1; k < pts.length; k++) {
            const dx = pts[k].x - pts[i].x, dy = pts[k].y - pts[i].y;
            const d = Math.hypot(dx, dy) || 0.1;
            if (d < 40) {
              const push = (40 - d) / 2, ux = dx / d, uy = dy / d;
              pts[i] = L.point(pts[i].x - ux * push, pts[i].y - uy * push);
              pts[k] = L.point(pts[k].x + ux * push, pts[k].y + uy * push);
            }
          }
        }
        stopMarks.forEach((it, i) => it.mk.setLatLng(m.layerPointToLatLng(pts[i])));
        resolveLabels(m, stopMarks);
      };
      layoutStops();
      m.on('zoomend', layoutStops);
      if (legend) legend.innerHTML = `
        <div class="leg-item"><span class="leg-num">1</span> Stop (Hindi + English)</div>
        <div class="leg-item"><span class="leg-line"></span> Route</div>
        <div class="leg-item"><span class="leg-arrow"></span> Direction of travel</div>
        ${j.approx ? '<p class="leg-note">Approximate / traditional route. The exact path is debated.</p>' : ''}`;
    } else {
      const dot = L.divIcon({ className: 'place-dot', html: '<span></span>', iconSize: [14, 14], iconAnchor: [7, 7] });
      const cluster = (L.markerClusterGroup ? L.markerClusterGroup({
        maxClusterRadius: 48,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 10
      }) : L.layerGroup());
      mapCluster = cluster;
      const bounds = [];
      matched.forEach(g => {
        if (!g.ll) return;
        const mk = L.marker(g.ll, { icon: dot, title: (g.hi || '') + ' / ' + (g.en || '') });
        mk.on('click', () => { location.hash = 'p/' + g.id; });
        cluster.addLayer(mk);
        bounds.push(g.ll);
      });
      m.addLayer(cluster);
      if (bounds.length) m.fitBounds(bounds, { padding: [24, 24], maxZoom: 6 });
      else m.setView([31.8, 35.2], 6);
      if (legend) legend.innerHTML = `
        <div class="leg-item"><span class="leg-dot"></span> Place (tap for the Hindi name and verses)</div>
        <div class="leg-item">Clusters show how many places are in that area. Zoom or tap a cluster to spread them.</div>`;
    }
    setTimeout(() => m.invalidateSize(), 80);
  };
  go();
}

function bindSearch() {
  const box = document.getElementById('q');
  if (box && (location.hash || '').indexOf('map') === 1) {
    box.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { mapQuery = box.value; listLimit = 40; mapView(); ev.preventDefault(); }
    });
  }
  const input = document.getElementById('q');
  if (!input) return;
  input.addEventListener('input', () => {
    q = input.value;
    listLimit = 40;
    const pos = input.selectionStart;
    const h = location.hash.slice(1);
    const restore = () => { const n = document.getElementById('q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
    if (h === 'people') { listView('p'); restore(); }
    else if (h === 'places') { listView('l'); restore(); }
    else if (h === 'map' || h.startsWith('map/')) {
      mapQuery = q;
      clearTimeout(bindSearch._t);
      bindSearch._t = setTimeout(() => { if (!h.startsWith('map/')) mapView(); restore(); }, 200);
    } else { home(); restore(); }
  });
  const mic = document.getElementById('btnMic');
  if (mic) mic.onclick = () => {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { toast('Voice search is not available on this browser'); return; }
    const r = new Rec();
    r.lang = 'hi-IN';
    r.onresult = ev => { q = ev.results[0][0].transcript; letter = ''; home(); };
    r.start();
  };
}

function bindClicks() {
  app.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', ev => {
    if (ev.target.closest('[data-speak],[data-verse]')) return;
    location.hash = 'p/' + el.dataset.open;
  }));
  app.querySelectorAll('[data-speak]').forEach(el => el.addEventListener('click', ev => {
    ev.preventDefault(); ev.stopPropagation();
    loadDetail(el.dataset.speak).then(e => { if (e) speak(e, speakLang, el); });
  }));
  app.querySelectorAll('[data-verse]').forEach(el => el.addEventListener('click', ev => {
    ev.preventDefault(); ev.stopPropagation();
    loadDetail(el.dataset.verse).then(e => { if (e) verseSheet(e); });
  }));
  app.querySelectorAll('[data-chip]').forEach(el => el.addEventListener('click', () => {
    chip = el.dataset.chip;
    letter = '';
    if (chip === 'p') { q = ''; location.hash = 'people'; return; }
    if (chip === 'l') { q = ''; location.hash = 'map'; return; }
    location.hash = 'home';
    home();
  }));
  app.querySelectorAll('[data-letter]').forEach(el => el.addEventListener('click', () => {
    letter = letter === el.dataset.letter ? '' : el.dataset.letter;
    const h = location.hash.slice(1);
    if (h === 'people') listView('p');
    else if (h === 'map' || h === 'places') listView('l');
    else home();
  }));
}


function exploreTiles() {
  const tiles = [
    ['#finder', 'search', "Your name's Bible meaning", 'Find a Bible name and its Hindi meaning'],
    ['#quiz', 'quiz', 'Daily quiz', '5 questions a day, with a streak'],
    ['#timeline', 'timeline', 'Timeline', 'Adam to Jesus (approximate dates)'],
    ['#genealogy', 'account_tree', "Jesus' genealogy", 'Matthew 1 and Luke 3'],
    ['#gods', 'wb_sunny', 'Names of God', 'El Shaddai, Yahweh Yireh, Immanuel…'],
    ['#women', 'diversity_1', 'Women of the Bible', 'Sarah, Ruth, Mary, Deborah…'],
    ['#map/abraham', 'explore', 'Journey maps', "Abraham, the Exodus, Paul's travels"],
    ['#lineage', 'favorite', 'Family trees', 'Couples and children, grouped by mother']
  ];
  return `<section class="flex flex-col gap-3">
    <div class="flex items-center justify-between px-1">
      <h3 class="font-headline-sm text-headline-sm font-semibold">Explore</h3>
      <a href="#more" class="font-label-sm text-label-sm text-primary font-semibold">All</a>
    </div>
    <div class="feature-grid">${tiles.map(([href,ic,ttl,sub]) => `<a class="feature-tile" href="${href}"><span class="material-symbols-outlined text-primary">${ic}</span><span class="ttl">${ttl}</span><span class="sub">${sub}</span></a>`).join('')}</div>
  </section>`;
}

function moreView() {
  setNav('more');
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <h2 class="font-headline-md text-headline-md text-primary px-1">Explore</h2>
    ${exploreTiles()}
    ${channelsSection()}
    <a href="privacy.html" class="mt-2 px-1 font-label-md text-primary font-semibold no-underline">Privacy Policy</a>
  </div>`;
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0900-\u097f]+/g, '');
}
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}
function finderScore(q, e) {
  q = norm(q); if (!q) return 0;
  const fields = [e.hi, shortHi(e), e.en, shortEn(e), e.pr].map(norm);
  let best = 0;
  for (const f of fields) {
    if (!f) continue;
    if (f === q) best = Math.max(best, 100);
    else if (f.startsWith(q) || q.startsWith(f)) best = Math.max(best, 86);
    else if (f.includes(q) || q.includes(f)) best = Math.max(best, 70);
    else {
      const d = lev(f.slice(0, Math.min(f.length, q.length + 2)), q);
      best = Math.max(best, Math.max(0, 55 - d * 10));
    }
  }
  return best;
}

let findQ = '', findG = 'all';
function finderView() {
  setNav('finder');
  const pool = people().filter(e => e.g !== 'd' && (findG === 'all' || e.g === findG));
  const ranked = findQ.trim()
    ? pool.map(e => ({ e, s: finderScore(findQ, e) })).filter(x => x.s >= 25).sort((a, b) => b.s - a.s).slice(0, 20)
    : [];
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <h2 class="font-headline-md text-headline-md text-primary">Your name's Bible meaning</h2>
    <p class="font-body-sm text-body-sm text-on-surface-variant">Type a Hindi or English name. We'll find matching or similar Bible names.</p>
    <input id="fq" class="w-full bg-surface-container rounded-full px-5 py-3.5 font-body-md text-body-md text-on-surface" placeholder="e.g. David, दाऊद, Priya, Yohan…" value="${esc(findQ)}"/>
    <div class="flex gap-2">${[['all','All'],['m','Boys'],['f','Girls']].map(([k,l]) => `<button type="button" data-fg="${k}" class="px-3.5 py-2 rounded-full font-label-md ${findG===k?'bg-primary text-on-primary':'bg-surface-container text-on-surface-variant'}">${l}</button>`).join('')}</div>
    <div id="fres">${ranked.length ? ranked.map(x => nameCard(x.e)).join('') : (findQ.trim() ? '<p class="text-on-surface-variant">No close match. Try another spelling.</p>' : '<p class="text-on-surface-variant">Try “Sarah”, “सारा”, or “John”.</p>')}</div>
  </div>`;
  const input = document.getElementById('fq');
  input.focus();
  input.setSelectionRange(findQ.length, findQ.length);
  input.addEventListener('input', () => { findQ = input.value; finderView(); });
  app.querySelectorAll('[data-fg]').forEach(b => b.onclick = () => { findG = b.dataset.fg; finderView(); });
  bindClicks();
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function isYesterday(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + 1);
  return todayKey() === dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}
function shuffle(a, seed) {
  const out = a.slice();
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function makeQuestions() {
  const pool = people().filter(e => e.g !== 'd' && e.hv && e.m && e.hi);
  const seed = todayKey().split('-').reduce((a, x) => a + Number(x), 1);
  const picked = shuffle(pool, seed).slice(0, 5);
  return picked.map((e, i) => {
    const type = i % 2 === 0 ? 'name' : 'meaning';
    const opts = shuffle([e, ...shuffle(pool.filter(x => x.id !== e.id), seed + i + 3).slice(0, 3)], seed + i * 9);
    return { id: e.id, type, opts: opts.map(x => x.id) };
  });
}
function loadQuiz() {
  const raw = JSON.parse(localStorage.getItem('hn-quiz') || '{}');
  if (raw.date === todayKey() && raw.qs) return raw;
  const keep = (raw.date && isYesterday(raw.date) && raw.done) ? (raw.streak || 0) : 0;
  const state = { date: todayKey(), qs: makeQuestions(), i: 0, score: 0, done: false, streak: keep, picked: null };
  localStorage.setItem('hn-quiz', JSON.stringify(state));
  return state;
}
function saveQuiz(s) { localStorage.setItem('hn-quiz', JSON.stringify(s)); }

function quizView() {
  setNav('quiz');
  const S = loadQuiz();
  if (S.done || S.i >= S.qs.length) {
    if (!S.done) { S.done = true; S.streak = (S.streak || 0) + 1; saveQuiz(S); }
    app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
      <h2 class="font-headline-md text-headline-md text-primary">Daily quiz</h2>
      <div class="bg-surface-container-low rounded-xl p-5 text-center">
        <p class="font-headline-lg-mobile text-primary font-bold">${S.score} / ${S.qs.length}</p>
        <p class="font-body-md mt-2">Today's score</p>
        <p class="font-label-lg text-tertiary mt-3">🔥 Streak: ${S.streak} day${S.streak===1?'':'s'}</p>
        <p class="font-body-sm text-on-surface-variant mt-3">Come back tomorrow for a new set of five questions.</p>
      </div>
    </div>`;
    return;
  }
  const q = S.qs[S.i];
  const ans = M[q.id];
  const prompt = q.type === 'name'
    ? `Whose name means “${esc(ans.m)}”?`
    : `What is the meaning of ${esc(ans.hi)} (${esc(shortEn(ans))})?`;
  const label = o => q.type === 'name' ? `${o.hi} (${shortEn(o)})` : `“${o.m}”`;
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <div class="flex items-center justify-between">
      <h2 class="font-headline-md text-headline-md text-primary">Daily quiz</h2>
      <span class="font-label-sm text-on-surface-variant">${S.i + 1} / ${S.qs.length} · 🔥 ${S.streak}</span>
    </div>
    <div class="bg-surface-container-low rounded-xl p-4 shadow-sm">
      <p class="font-headline-sm text-headline-sm mb-2">${prompt}</p>
      ${q.opts.map(id => `<button type="button" class="quiz-opt" data-opt="${id}">${esc(label(M[id]))}</button>`).join('')}
    </div>
  </div>`;
  app.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => {
    if (S.picked) return;
    S.picked = b.dataset.opt;
    const ok = S.picked === q.id;
    if (ok) S.score++;
    app.querySelectorAll('[data-opt]').forEach(x => {
      if (x.dataset.opt === q.id) x.classList.add('ok');
      else if (x.dataset.opt === S.picked) x.classList.add('bad');
    });
    S.i++;
    S.picked = null;
    if (S.i >= S.qs.length) { S.done = true; S.streak = (S.streak || 0) + 1; }
    saveQuiz(S);
    setTimeout(quizView, 700);
  });
}

function timelineView() {
  setNav('timeline');
  const items = (C.timeline || []).filter(x => M[x.id]);
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <h2 class="font-headline-md text-headline-md text-primary">Timeline</h2>
    <p class="font-body-sm text-on-surface-variant">${esc(C.timelineNote || 'Dates are approximate / traditional.')}</p>
    <div class="tl">${items.map(x => {
      const e = M[x.id];
      return `<div class="tl-item"><a href="#p/${e.id}" class="no-underline text-inherit">
        <div class="font-label-sm text-tertiary font-semibold">${esc(x.era)} <span class="text-on-surface-variant font-medium">· approximate</span></div>
        <div class="font-headline-sm text-headline-sm inline-flex items-center gap-1.5">${genderIcon(e.g)} ${esc(e.hi)} <span class="font-label-sm text-on-surface-variant">(${esc(shortEn(e))})</span></div>
        <div class="font-body-sm text-on-surface-variant">${esc(x.note || '')}</div>
      </a></div>`;
    }).join('')}</div>
  </div>`;
}

function genealogyView(which) {
  setNav('genealogy');
  const tab = which === 'luke' ? 'luke' : 'matt';
  const list = C[tab] || [];
  const ref = tab === 'matt' ? C.mattRef : C.lukeRef;
  const title = tab === 'matt' ? 'Matthew 1' : 'Luke 3';
  const note = tab === 'matt'
    ? 'Abraham → David → Jesus, as named in the IRV Hindi of Matthew 1.'
    : 'Adam → Jesus, read in birth order from the IRV Hindi of Luke 3:23–38 (the text itself lists the line backwards).';
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <h2 class="font-headline-md text-headline-md text-primary">Jesus' genealogy</h2>
    <div class="flex gap-2">${[['matt','Matthew 1'],['luke','Luke 3']].map(([k,l]) => `<a href="#genealogy/${k}" class="px-3.5 py-2 rounded-full font-label-md no-underline ${tab===k?'bg-primary text-on-primary':'bg-surface-container text-on-surface-variant'}">${l}</a>`).join('')}</div>
    <p class="font-body-sm text-on-surface-variant">${esc(note)} ${esc(ref || '')}</p>
    <div class="gen-line">${list.map((n,i) => {
      const chip = n.id && M[n.id]
        ? `<a href="#p/${n.id}" class="px-2.5 py-1 rounded bg-secondary-container text-on-secondary-container font-label-md no-underline">${esc(n.hi)}</a>`
        : `<span class="px-2.5 py-1 rounded bg-surface-container text-on-surface font-label-md">${esc(n.hi)}</span>`;
      return `${i ? '<span class="gen-arrow">→</span>' : ''}${chip}`;
    }).join('')}</div>
  </div>`;
}

function godsView() {
  setNav('gods');
  const list = C.gods || [];
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <h2 class="font-headline-md text-headline-md text-primary">Names of God</h2>
    <p class="font-body-sm text-on-surface-variant">Hindi forms are taken from the IRV verse where each name or title appears.</p>
    ${list.map(e => `<article class="bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col gap-2">
      <div class="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 class="font-headline-sm text-headline-sm font-bold text-primary">${esc(e.hi)}</h3>
        <span class="heb text-primary text-[20px] font-semibold">${esc(e.o)}</span>
      </div>
      <div class="font-label-md text-on-surface-variant">${esc(e.en)} · ${esc(e.pr)}</div>
      <p class="font-body-md">“${esc(e.m)}”</p>
      <div class="font-label-sm text-tertiary font-semibold">${esc(e.ref)}</div>
      <p class="font-body-sm leading-relaxed bg-surface-container-lowest/80 rounded-lg p-3">${esc(e.v)}</p>
    </article>`).join('')}
  </div>`;
}

function womenView() {
  setNav('women');
  const list = women();
  const page = paged(list);
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <h2 class="font-headline-md text-headline-md text-primary">Women of the Bible</h2>
    <p class="font-body-sm text-on-surface-variant">${list.length} women in this lexicon. Tap a name to open it.</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${page.slice.map(nameCard).join('')}</div>
    ${page.more}
  </div>`;
  bindClicks();
  bindMore();
}

function makeCardCanvas(e, story) {
  const W = 1080, H = story ? 1920 : 1080;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff8f8'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f5eced'; ctx.fillRect(60, 60, W - 120, H - 120);
  ctx.strokeStyle = '#dcc0ba'; ctx.lineWidth = 3; ctx.strokeRect(60, 60, W - 120, H - 120);
  ctx.fillStyle = '#7f2c15'; ctx.fillRect(60, 60, W - 120, story ? 200 : 160);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
  ctx.font = '600 44px "Noto Serif", serif';
  ctx.fillText('Holy Names', W / 2, story ? 175 : 155);
  const mid = story ? 820 : 480;
  ctx.fillStyle = '#7f2c15';
  ctx.font = '700 110px "Noto Serif Devanagari", "Noto Serif", serif';
  ctx.fillText(shortHi(e), W / 2, mid);
  ctx.fillStyle = '#56423d';
  ctx.font = '600 64px "Noto Serif Hebrew", "Noto Serif Greek", "Noto Serif", serif';
  ctx.fillText(e.o || '', W / 2, mid + 110);
  ctx.font = '500 40px Inter, sans-serif';
  ctx.fillText(shortEn(e), W / 2, mid + 180);
  ctx.fillStyle = '#fff8f8';
  const boxY = mid + 230, boxH = story ? 420 : 260;
  roundRect(ctx, 140, boxY, W - 280, boxH, 24); ctx.fill();
  ctx.fillStyle = '#6d3a00';
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText('MEANING', W / 2, boxY + 60);
  ctx.fillStyle = '#1e1b1c';
  ctx.font = '600 44px "Noto Serif Devanagari", "Noto Serif", serif';
  wrapText(ctx, '“' + e.m + '”', W / 2, boxY + 130, W - 360, 56);
  ctx.fillStyle = '#5c623b';
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText(e.ref, W / 2, boxY + boxH - 40);
  ctx.fillStyle = '#89726c';
  ctx.font = '400 26px Inter, sans-serif';
  ctx.fillText('Bible Names in Hindi', W / 2, H - 100);
  return c;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function wrapText(ctx, text, x, y, max, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > max && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = t;
  }
  if (line) ctx.fillText(line, x, yy);
}
function canvasPng(canvas) {
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}
async function downloadCanvas(e, story) {
  const blob = await canvasPng(makeCardCanvas(e, story));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = shortHi(e) + (story ? '-status' : '-card') + '.png';
  a.click();
}
async function shareCanvas(e, story) {
  const blob = await canvasPng(makeCardCanvas(e, story));
  const file = new File([blob], shortHi(e) + '.png', { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: e.hi, text: shareText(e) });
      return;
    }
  } catch (err) {}
  downloadCanvas(e, story);
}

function cardView(id) {
  setNav('card');
  const e = M[id] || M.jesus;
  const sq = makeCardCanvas(e, false).toDataURL('image/png');
  const st = makeCardCanvas(e, true).toDataURL('image/png');
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-sm pt-2">
    <button type="button" class="text-primary font-label-md font-semibold self-start" onclick="history.back()">← Back</button>
    <h2 class="font-headline-md text-headline-md text-primary">Shareable name card</h2>
    <p class="font-body-sm text-on-surface-variant">Square (1080×1080) and status (1080×1920) cards for WhatsApp.</p>
    <div class="card-preview"><img alt="Square card" src="${sq}"/></div>
    <div class="flex gap-2 flex-wrap">
      <button type="button" id="dlSq" class="flex-1 rounded-xl bg-primary text-on-primary py-3 font-label-lg font-semibold">Download square</button>
      <button type="button" id="shSq" class="flex-1 rounded-xl bg-secondary text-on-secondary py-3 font-label-lg font-semibold">Share</button>
    </div>
    <div class="card-preview" style="max-width:220px"><img alt="Status card" src="${st}"/></div>
    <button type="button" id="dlSt" class="rounded-xl bg-tertiary-container text-on-tertiary-container py-3 font-label-lg font-semibold">Download status</button>
  </div>`;
  document.getElementById('dlSq').onclick = () => downloadCanvas(e, false);
  document.getElementById('shSq').onclick = () => shareCanvas(e, false);
  document.getElementById('dlSt').onclick = () => downloadCanvas(e, true);
}


function route() {
  const h = decodeURIComponent((location.hash || '#home').slice(1));
  const path0 = h.split('/')[0];
  if (!(path0 === 'people' || path0 === 'places' || path0 === 'home' || path0 === 'meanings' || (path0 === 'map' && !h.startsWith('map/')))) {
    /* keep listLimit across show-more on the same list; reset when leaving search context handled below */
  }
  const resetList = !['people','places','home','women','map'].includes(path0);
  // Reset show-more when the hash target changes type, except when only expanding.
  // We reset in bindSearch when q/letter change; here reset when navigating to a new page type.
  if (route._last && route._last !== h && !h.startsWith('p/') && path0 !== route._last.split('/')[0]) {
    listLimit = 40;
  }
  if (route._last && route._last !== h && (path0 === 'lineage') && route._last.split('/')[0] === 'lineage') {
    /* keep expand only if same root, already handled */
  }
  route._last = h;
  if (path0 !== 'map') mapQuery = '';
  if (h === 'people') return listView('p');
  if (h === 'places') return listView('l');
  if (h === 'map' || h.startsWith('map/')) {
    return ensureGeo().then(() => mapView(h.split('/')[1])).catch(err => { console.warn(err); mapView(h.split('/')[1]); });
  }
  if (h === 'meanings') { chip = 'm'; return home(); }
  if (h === 'saved') return savedView();
  if (h === 'lineage' || h.startsWith('lineage/')) return lineageView(h.split('/')[1]);
  if (h.startsWith('p/')) {
    return loadDetail(h.slice(2)).then(e => e ? detail(e) : home());
  }
  if (h === 'more') return moreView();
  if (h === 'finder') return finderView();
  if (h === 'quiz') return quizView();
  if (h === 'timeline') return timelineView();
  if (h === 'genealogy' || h.startsWith('genealogy/')) return genealogyView(h.split('/')[1]);
  if (h === 'gods') return godsView();
  if (h === 'women') return womenView();
  if (h.startsWith('card/')) {
    return loadDetail(h.split('/')[1]).then(e => e ? cardView(e.id) : home());
  }
  if (rec(h)) return loadDetail(h).then(e => e ? detail(e) : home());
  home();
}

document.querySelectorAll('.nav-tab').forEach(a => a.addEventListener('click', ev => {
  if (a.dataset.path === 'home') { q = ''; chip = 'all'; letter = ''; }
  const here = location.hash || '#home';
  if (here === '#' + a.dataset.path || (a.dataset.path === 'home' && (here === '#' || here === '#home'))) {
    ev.preventDefault();
    route();
  }
}));

document.getElementById('btnSearch').onclick = () => {
  if (!location.hash || location.hash === '#home') {
    const i = document.getElementById('q');
    if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); }
  } else location.hash = 'home';
};
document.getElementById('btnSaved').onclick = () => { location.hash = 'saved'; };
document.getElementById('btnAbout').onclick = aboutSheet;

window.closeSheet = closeSheet;
document.addEventListener('click', ev => {
  const y = ev.target.closest('[data-yt]');
  if (!y) return;
  ev.preventDefault();
  openExt(y.dataset.yt);
});

addEventListener('hashchange', route);

function ingestIndex(index) {
  INDEX = index;
  D = index;
  index.forEach(e => {
    const f = FAM[e.id] || {};
    M[e.id] = normalize(Object.assign({}, e, {
      g: f.g || e.g,
      hi: f.hi || e.hi,
      en: f.en || e.en,
      hv: f.hv != null ? f.hv : e.hv,
      father: f.f || e.father,
      mother: f.m || e.mother,
      spouse: f.p || e.spouse,
      children: f.c || e.children,
      siblings: f.sib || e.siblings
    }));
  });
  Object.keys(ALIAS).forEach(k => {
    if (!M[k] && M[ALIAS[k]]) M[k] = M[ALIAS[k]];
  });
}

Promise.all([
  fetch('data/index.json' + CACHE_V).then(r => r.json()),
  fetch('data/alias.json' + CACHE_V).then(r => r.json()),
  fetch('data/family.json' + CACHE_V).then(r => r.json()),
  fetch('data/content.json' + CACHE_V).then(r => r.json()),
  fetch('data/stats.json' + CACHE_V).then(r => r.json()).catch(() => ({}))
]).then(([index, alias, fam, content, stats]) => {
  ALIAS = alias || {};
  FAM = fam || {};
  C = content || {};
  STATS = stats || {};
  ingestIndex(index);
  route();
}).catch(err => {
  console.error(err);
  app.innerHTML = '<p class="px-4 py-8 text-on-surface-variant">Could not load the lexicon. Please refresh.</p>';
});
