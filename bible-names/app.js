const app = document.getElementById('app');
const sheetEl = document.getElementById('sheet');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortEn = e => (e.en || '').split(' (')[0];
const shortHi = e => (e.hi || '').split(' (')[0];
const isGk = e => (e.s || '')[0] === 'G';
const origCls = e => isGk(e) ? 'gk' : 'heb';
const people = () => D.filter(e => e.t === 'p');
const places = () => D.filter(e => e.t === 'l');
const kidsOf = id => D.filter(e => (e.father || []).includes(id) || (e.mother || []).includes(id));
const letterOf = e => shortEn(e).charAt(0).toUpperCase();

let D = [], M = {};
let q = '', chip = 'all', letter = '';
let speakLang = 'hi';
let fav = new Set(JSON.parse(localStorage.getItem('hn-fav') || '[]'));
let mapObj = null;

const POPULAR = ['jesus', 'david', 'abraham', 'mary'];
const TREES = [
  { id: 'adam', label: 'Adam' },
  { id: 'abraham', label: 'Abraham' },
  { id: 'moses', label: 'Moses' },
  { id: 'david', label: 'David' },
  { id: 'jesus', label: 'Jesus' }
];
const THOUGHT = {
  ref: 'मत्ती 18:20',
  hi: 'क्योंकि जहाँ दो या तीन मेरे नाम पर इकट्ठे होते हैं वहाँ मैं उनके बीच में होता हूँ।',
  tag: 'Divine Presence'
};

function saveFav() { localStorage.setItem('hn-fav', JSON.stringify([...fav])); }

function dayEntry() {
  return D[Math.floor(Date.now() / 864e5) % D.length];
}

function osmTile(lat, lon, z) {
  z = z || 11;
  const n = 2 ** z;
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
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
  sheetEl.classList.remove('hidden');
  sheetEl.querySelector('.sheet-card').innerHTML = html;
  sheetEl.querySelector('.sheet-bg').onclick = closeSheet;
}
function closeSheet() { sheetEl.classList.add('hidden'); }

function verseSheet(e) {
  openSheet(`
    <button class="text-primary font-label-md mb-2" onclick="closeSheet()">Close</button>
    <div class="font-label-sm uppercase tracking-wider text-tertiary font-semibold mb-1">Scripture</div>
    <div class="font-headline-sm text-headline-sm text-primary mb-2">${esc(e.ref)}</div>
    <p class="font-body-lg text-body-lg leading-relaxed">${esc(e.v)}</p>
    <button class="mt-4 text-primary font-label-md font-semibold" onclick="closeSheet();location.hash='p/${esc(e.id)}'">View name →</button>`);
}

function aboutSheet() {
  openSheet(`
    <button class="text-primary font-label-md mb-2" onclick="closeSheet()">Close</button>
    <h2 class="font-headline-md text-headline-md text-primary mb-2">Holy Names</h2>
    <p class="font-body-md text-body-md text-on-surface-variant">A lexicon of Bible names and places for Hindi-speaking Christians. Each entry shows the IRV Hindi spelling, the original Hebrew or Greek, a Devanagari pronunciation, and a simple Hindi meaning.</p>
    <p class="font-body-sm text-body-sm text-on-surface-variant mt-3">${D.length} entries · Strong's lexicon (public domain) · IRV Hindi Bible</p>`);
}

function setNav(path) {
  const labels = { home: 'Home', people: 'People', lineage: 'Lineage', map: 'Map', saved: 'Saved', detail: 'Name' };
  document.getElementById('hdrSub').textContent = '• ' + (labels[path] || 'Home');
  document.querySelectorAll('.nav-tab').forEach(a => {
    a.classList.toggle('on', a.dataset.path === (path === 'detail' ? '' : path));
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
          <h4 class="font-headline-sm text-headline-sm font-bold text-on-surface">${esc(e.hi)}</h4>
          <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">(${esc(shortEn(e))})</span>
        </div>
        <div class="text-[18px] leading-tight text-primary font-semibold mt-0.5 ${origCls(e)}">${esc(e.o)}</div>
      </div>
      <button type="button" aria-label="Pronunciation" class="w-8 h-8 rounded-full bg-surface-container-highest text-primary flex items-center justify-center hover:bg-primary-container hover:text-on-primary transition-all active:scale-95 shadow-sm flex-shrink-0" data-speak="${e.id}">
        <span class="material-symbols-outlined text-[18px]">volume_up</span>
      </button>
    </div>
    <div class="flex flex-col gap-1.5 pt-1">
      <div class="flex items-start gap-1.5 text-on-surface-variant font-body-sm text-body-sm">
        <span class="material-symbols-outlined text-tertiary text-[16px] mt-0.5">menu_book</span>
        <span>Meaning: <strong class="text-on-surface font-semibold">“${esc(e.m)}”</strong></span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button type="button" class="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-medium" data-verse="${e.id}">${esc(e.ref)}</button>
        <span class="text-on-surface-variant font-label-sm text-label-sm">${esc(e.s)}</span>
      </div>
    </div>
  </article>`;
}

function placeCard(e) {
  const [lat, lon] = e.ll || [0, 0];
  const bg = e.ll ? `background-image:url('${osmTile(lat, lon, 12)}')` : 'background:#5c623b';
  return `<article class="bg-surface-container-low rounded-xl overflow-hidden shadow-sm flex flex-col cursor-pointer" data-open="${e.id}">
    <div class="place-hero w-full" style="${bg}">
      <div class="absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-inverse-surface/30 to-transparent"></div>
      <div class="absolute bottom-2.5 left-3 right-3 text-inverse-on-surface">
        <div class="flex items-baseline gap-2">
          <span class="font-headline-sm text-headline-sm font-bold text-surface-container-lowest">${esc(e.hi)}</span>
          <span class="font-label-sm text-label-sm opacity-90">(${esc(shortEn(e))})</span>
          <span class="font-body-sm text-body-sm font-semibold text-secondary-fixed ml-auto ${origCls(e)}">${esc(e.o)}</span>
        </div>
      </div>
    </div>
    <div class="p-3.5 flex flex-col gap-2">
      <div class="flex items-center justify-between text-body-sm font-body-sm gap-2">
        <span class="text-on-surface-variant font-medium">Original Literal Meaning:</span>
        <span class="font-semibold text-tertiary text-right">“${esc(e.m)}”</span>
      </div>
      <div class="flex items-center gap-2 pt-1">
        <button type="button" class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-medium" data-verse="${e.id}">${esc(e.ref)}</button>
        <span class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-medium">${esc(e.pr)}</span>
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
  return (e.hi + e.en + e.pr + e.m + e.o + e.s + e.ref).toLowerCase().includes(t);
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
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${results.map(chip === 'l' ? placeCard : nameCard).join('') || '<p class="text-on-surface-variant px-1">No match</p>'}</div>
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
      </section>`;
  }

  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-lg">
    <section class="flex flex-col gap-space-sm pt-space-xs">
      ${searchBox('Search: Jesus, Jerusalem, David, Abraham...')}
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
  const title = kind === 'l' ? 'Holy Places & Cities' : kind === 'm' ? 'Meanings' : 'Biblical Names';
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-lg pt-space-xs">
    ${searchBox(kind === 'l' ? 'Search places...' : 'Search names...')}
    ${alphaStrip(list)}
    <section class="flex flex-col gap-3">
      <h3 class="font-headline-sm text-headline-sm px-1">${title} <span class="text-on-surface-variant font-label-sm">${shown.length}</span></h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${shown.map(kind === 'l' ? placeCard : nameCard).join('') || '<p class="text-on-surface-variant px-1">No match</p>'}</div>
    </section>
  </div>`;
  bindSearch();
  bindClicks();
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
  const groups = [
    ['father', 'Father'], ['mother', 'Mother'], ['spouse', 'Spouse'],
    ['siblings', 'Siblings'], ['children', 'Children']
  ];
  const rels = groups.map(([k, lab]) => {
    const ids = k === 'children' ? kidsOf(e.id).map(x => x.id) : (e[k] || []);
    if (!ids.length) return '';
    return `<div class="mb-2"><div class="font-label-sm text-label-sm text-on-surface-variant mb-1">${lab}</div>
      <div class="flex flex-wrap gap-2">${ids.map(id => M[id] ? `<a href="#p/${id}" class="px-3 py-1.5 rounded-full bg-surface-container text-on-surface font-label-md text-label-md no-underline">${esc(M[id].hi)}</a>` : '').join('')}</div></div>`;
  }).filter(Boolean);
  if (!rels.length) return '';
  return `<section class="bg-surface-container-low rounded-xl p-4 shadow-sm">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-headline-sm text-headline-sm font-semibold">Family</h3>
      <a href="#lineage/${e.id}" class="font-label-sm text-label-sm text-primary font-semibold hover:underline">View full tree</a>
    </div>
    ${rels.join('')}
  </section>`;
}

function detail(e) {
  if (!e) return home();
  setNav('detail');
  scrollTo(0, 0);
  const saved = fav.has(e.id);
  const rootHint = isGk(e) ? 'Greek' : 'Hebrew';
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-md pt-space-sm">
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
            <h1 class="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary tracking-tight">${esc(e.hi)}</h1>
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
        <p class="font-body-lg text-body-lg text-on-surface font-medium leading-relaxed">“${esc(e.m)}”</p>
      </div>
    </section>

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
      <p class="font-body-md text-body-md text-on-surface-variant">Pronounced <strong class="text-on-surface">${esc(e.pr)}</strong>. In the IRV Hindi Bible this name is written <strong class="text-on-surface">${esc(e.hi)}</strong>, meaning “${esc(e.m)}”.</p>
    </section>

    <section class="bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col gap-2">
      <h3 class="font-headline-sm text-headline-sm font-semibold">Historical Context</h3>
      <div class="font-label-sm text-label-sm uppercase tracking-wider text-tertiary font-semibold">First reference · ${esc(e.ref)}</div>
      <p class="font-body-lg text-body-lg leading-relaxed bg-surface-container-lowest/80 rounded-lg p-3.5">${esc(e.v)}</p>
    </section>

    ${e.ll ? `<section class="bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col gap-2">
      <h3 class="font-headline-sm text-headline-sm font-semibold">Map</h3>
      <div id="mapel"></div>
    </section>` : ''}

    ${familyBits(e)}

    <div class="flex gap-2">
      <button type="button" id="btnShare2" class="flex-1 rounded-xl bg-primary text-on-primary py-3 font-label-lg font-semibold">Share</button>
      <button type="button" id="btnWa" class="flex-1 rounded-xl bg-secondary text-on-secondary py-3 font-label-lg font-semibold">WhatsApp</button>
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
  app.querySelectorAll('.lang-btn').forEach(b => b.onclick = () => { speakLang = b.dataset.lang; detail(e); });
  if (e.ll) {
    const go = () => {
      if (!window.L) return setTimeout(go, 200);
      const m = L.map('mapel').setView(e.ll, 8);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(m);
      L.marker(e.ll).addTo(m).bindPopup(e.hi).openPopup();
    };
    go();
  }
}

function treeNode(id, kind) {
  const e = M[id];
  if (!e) return '';
  return `<button type="button" class="tree-node ${kind || ''}" onclick="location.hash='p/${id}'">
    <span class="dot"></span>
    <span class="tn-hi">${esc(shortHi(e))}</span>
    <span class="tn-en">${esc(shortEn(e))}</span>
  </button>`;
}

function renderTree(rootId) {
  const e = M[rootId];
  if (!e) return '<p class="text-on-surface-variant">No family links for this name yet.</p>';
  const parents = [...(e.father || []), ...(e.mother || [])];
  const spouses = e.spouse || [];
  const sibs = e.siblings || [];
  const kids = kidsOf(rootId);
  let html = '<div class="tree">';
  if (parents.length) {
    html += `<div class="tree-row">${parents.map(id => treeNode(id)).join('')}</div><div class="tree-line"></div>`;
  }
  html += `<div class="tree-row">${treeNode(rootId, 'me')}${spouses.map(id => treeNode(id)).join('')}${sibs.map(id => treeNode(id, 'side')).join('')}</div>`;
  if (kids.length) {
    html += `<div class="tree-line"></div><div class="tree-branch-row">`;
    for (const k of kids) {
      const ksp = k.spouse || [];
      const grand = kidsOf(k.id);
      html += `<div class="tree-branch">${treeNode(k.id)}${ksp.map(id => treeNode(id)).join('')}`;
      if (grand.length) {
        html += `<div class="tree-line"></div><div class="tree-row">${grand.map(g => treeNode(g.id)).join('')}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += '</div>';
  return html;
}

function lineageView(rootId) {
  setNav('lineage');
  const root = (rootId && M[rootId]) ? rootId : 'abraham';
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-md pt-space-sm">
    <div class="px-1">
      <h2 class="font-headline-md text-headline-md text-primary">Biblical Family Tree</h2>
      <p class="font-body-sm text-body-sm text-on-surface-variant">Tap a name to open it. Filled terracotta marks the person in focus; olive rings are siblings.</p>
    </div>
    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
      ${TREES.map(t => `<button type="button" data-tree="${t.id}" class="flex-shrink-0 px-3.5 py-2 rounded-full font-label-md text-label-md ${t.id === root ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'}">${esc(M[t.id] ? M[t.id].hi : t.label)}</button>`).join('')}
    </div>
    <section class="bg-surface-container-low rounded-xl p-4 shadow-sm overflow-x-auto">
      ${renderTree(root)}
    </section>
  </div>`;
  app.querySelectorAll('[data-tree]').forEach(b => b.onclick = () => { location.hash = 'lineage/' + b.dataset.tree; });
}

function mapView() {
  setNav('map');
  const list = places();
  app.innerHTML = `<div class="flex flex-col w-full px-gutter pb-8 gap-space-md pt-space-sm">
    <div class="flex items-center justify-between px-1">
      <h2 class="font-headline-md text-headline-md text-primary">Holy Places &amp; Cities</h2>
      <span class="font-label-sm text-label-sm text-on-surface-variant">${list.length} places</span>
    </div>
    <div id="mapel" class="shadow-sm"></div>
    <div id="placeInfo"></div>
    <div class="grid grid-cols-1 gap-3.5">${list.map(placeCard).join('')}</div>
  </div>`;
  bindClicks();
  const go = () => {
    if (!window.L) return setTimeout(go, 200);
    if (mapObj) { try { mapObj.remove(); } catch (err) {} mapObj = null; }
    const m = L.map('mapel').setView([31.7, 35.2], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(m);
    mapObj = m;
    const info = document.getElementById('placeInfo');
    const select = e => {
      m.setView(e.ll, 9);
      info.innerHTML = `<div class="bg-surface-container-low rounded-xl p-4 shadow-sm">
        <div class="flex items-baseline gap-2">
          <h3 class="font-headline-sm text-headline-sm font-bold text-primary">${esc(e.hi)}</h3>
          <span class="font-label-sm text-on-surface-variant">(${esc(shortEn(e))})</span>
          <span class="ml-auto ${origCls(e)} text-primary font-semibold">${esc(e.o)}</span>
        </div>
        <p class="font-body-md text-body-md mt-1">“${esc(e.m)}”</p>
        <p class="font-label-sm text-on-surface-variant mt-1">${esc(e.pr)} · ${esc(e.ref)}</p>
        <a href="#p/${e.id}" class="inline-block mt-2 font-label-md text-primary font-semibold">View in Detail →</a>
      </div>`;
    };
    list.forEach(e => {
      if (!e.ll) return;
      L.marker(e.ll).addTo(m).bindPopup(e.hi).on('click', () => select(e));
    });
    if (list[0]) select(list[0]);
  };
  go();
}

function bindSearch() {
  const input = document.getElementById('q');
  if (!input) return;
  input.addEventListener('input', () => {
    q = input.value;
    const pos = input.selectionStart;
    const h = location.hash.slice(1);
    if (h === 'people') listView('p');
    else if (h === 'map' || h === 'places') listView('l');
    else home();
    const n = document.getElementById('q');
    if (n) { n.focus(); n.setSelectionRange(pos, pos); }
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
    const e = M[el.dataset.speak];
    if (e) speak(e, speakLang, el);
  }));
  app.querySelectorAll('[data-verse]').forEach(el => el.addEventListener('click', ev => {
    ev.preventDefault(); ev.stopPropagation();
    const e = M[el.dataset.verse];
    if (e) verseSheet(e);
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

function route() {
  mapObj = null;
  const h = (location.hash || '#home').slice(1);
  if (!h || h === 'home') return home();
  if (h === 'people') return listView('p');
  if (h === 'places') return listView('l');
  if (h === 'map') return mapView();
  if (h === 'meanings') { chip = 'm'; return home(); }
  if (h === 'saved') return savedView();
  if (h === 'lineage' || h.startsWith('lineage/')) return lineageView(h.split('/')[1]);
  if (h.startsWith('p/')) return detail(M[h.slice(2)]);
  if (M[h]) return detail(M[h]);
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
addEventListener('hashchange', route);

fetch('names.json').then(r => r.json()).then(data => {
  D = data;
  data.forEach(e => { M[e.id] = e; });
  route();
});
