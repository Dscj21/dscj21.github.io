(function (root) {
  'use strict';

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', i = 0, q = false;
    const s = String(text || '').replace(/^\uFEFF/, '');
    while (i < s.length) {
      const c = s[i];
      if (q) {
        if (c === '"') {
          if (s[i + 1] === '"') { cell += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        cell += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === ',') { row.push(cell); cell = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
      cell += c; i++;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => String(x || '').trim()));
  }

  function colIndex(head, names) {
    return head.findIndex(h => names.indexOf(h) !== -1);
  }

  function normHead(h) {
    return String(h || '').trim().toLowerCase().replace(/\s+/g, '_');
  }

  function rowsToMaps(rows) {
    if (!rows || !rows.length) return [];
    const head = rows[0].map(normHead);
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const line = rows[r] || [];
      const o = {};
      for (let i = 0; i < head.length; i++) {
        if (!head[i]) continue;
        o[head[i]] = line[i] == null ? '' : line[i];
      }
      out.push(o);
    }
    return out;
  }

  function str(v) { return v == null ? '' : String(v).trim(); }

  function isYes(v, defaultYes) {
    const s = str(v).toLowerCase();
    if (!s) return defaultYes !== false;
    return !(['no', 'n', 'false', '0', 'off', 'disabled'].indexOf(s) >= 0);
  }

  function looksLikeCsv(text) {
    if (!text || /^\s*</.test(text) || /accounts\.google\.com/.test(text)) return false;
    const first = String(text).split(/\r?\n/).find(l => l.trim());
    return !!first && /id|hindi_name|hindi_meaning|english_name|journey_id|question|english_label|kind|key|enabled/i.test(first);
  }

  function gvizToRows(data) {
    const table = data && data.table;
    if (!table) return [];
    const head = (table.cols || []).map(c => c.label || c.id || '');
    const body = (table.rows || []).map(r => (r.c || []).map(c => {
      if (!c) return '';
      if (c.v == null) return '';
      return String(c.f != null ? c.f : c.v);
    }));
    return [head].concat(body);
  }

  function baseName(en) {
    const s = str(en);
    const m = s.match(/^(.*)\s+\([^)]+\)\s*$/);
    return (m ? m[1] : s).trim();
  }
  function nameKey(en) { return baseName(en).toLowerCase(); }

  function packFromTabRows(tabs) {
    const pack = { names: [], places: [], journeys: [], quiz: [], featured: [], texts: {}, exceptions: [] };
    const namesRows = tabs.Names || tabs.Meanings || tabs.names || tabs.meanings;
    if (namesRows) pack.names = rowsToMaps(namesRows);
    const exRows = tabs['Name exceptions'] || tabs['Name Exceptions'] || tabs.Exceptions || tabs.exceptions;
    if (exRows) pack.exceptions = rowsToMaps(exRows);
    if (tabs.Places || tabs.places) pack.places = rowsToMaps(tabs.Places || tabs.places);
    if (tabs.Journeys || tabs.journeys) pack.journeys = rowsToMaps(tabs.Journeys || tabs.journeys);
    if (tabs.Quiz || tabs.quiz) pack.quiz = rowsToMaps(tabs.Quiz || tabs.quiz);
    if (tabs.Featured || tabs.featured) pack.featured = rowsToMaps(tabs.Featured || tabs.featured);
    const textRows = tabs.Texts || tabs.texts;
    if (textRows) {
      rowsToMaps(textRows).forEach(r => {
        const key = str(r.key);
        if (!key) return;
        pack.texts[key] = { en: str(r.english || r.en), hi: str(r.hindi || r.hi) };
      });
    }
    return pack;
  }

  function num(v) {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }

  function field(row, names) {
    for (let i = 0; i < names.length; i++) {
      if (row[names[i]] != null && String(row[names[i]]).trim() !== '') return row[names[i]];
    }
    for (let i = 0; i < names.length; i++) {
      if (Object.prototype.hasOwnProperty.call(row, names[i])) return row[names[i]];
    }
    return '';
  }

  function parseQuizRow(r) {
    const question = str(field(r, ['question', 'q', 'prompt']));
    const opts = [1, 2, 3, 4].map(i => str(field(r, ['option' + i, 'opt' + i, 'option_' + i])));
    const correct = str(field(r, ['correct_answer', 'correct', 'answer']));
    if (!question || opts.filter(Boolean).length < 2 || !correct) return null;
    return {
      id: str(r.id) || ('q_' + question.slice(0, 24)),
      type: 'custom',
      question,
      opts,
      correct,
      explanation: str(field(r, ['explanation', 'explain', 'note'])),
      enabled: isYes(r.enabled, true)
    };
  }

  function applyPack(pack, ctx) {
    if (!pack || !ctx) return {};
    const D = ctx.D || [];
    const M = ctx.M || {};
    const GEO = ctx.GEO;
    const C = ctx.C || {};
    const rec = ctx.rec;
    const normalize = ctx.normalize || (e => e);
    const result = { dayIds: null, famousIds: null, journeyLab: {}, thought: null, texts: pack.texts || {}, quiz: [], featuredPlaceIds: [] };

    function find(id) { return rec ? rec(id) : (M[id] || D.find(e => e.id === id)); }

    function ensure(id, typ) {
      let e = find(id);
      if (e) return e;
      const t = (typ === 'place' || typ === 'l' || typ === 'location') ? 'l' : 'p';
      e = normalize({
        id, t, en: '', hi: id, m: '', hv: false, vc: 0, g: '', aka: [],
        father: [], mother: [], spouse: [], children: [], siblings: []
      });
      D.push(e);
      M[id] = e;
      return e;
    }

    (D || []).forEach(e => { if (e) { e._off = false; e._mapOff = false; e._featured = false; } });

    function touchName(e, r, typ) {
      const hi = str(field(r, ['hindi_name', 'hindiname', 'hi', 'hindi']));
      const m = str(field(r, ['hindi_meaning', 'meaning', 'hindimeaning']));
      const en = str(field(r, ['english_name', 'english', 'en']));
      if (hi) e.hi = hi;
      if (m) e.m = m;
      if (en && !e.en) e.en = en;
      if (!isYes(r.enabled, true)) e._off = true;
    }

    (pack.names || []).forEach(r => {
      const id = str(field(r, ['id']));
      const hi = str(field(r, ['hindi_name', 'hindiname', 'hi', 'hindi']));
      const m = str(field(r, ['hindi_meaning', 'meaning', 'hindimeaning']));
      const en = str(field(r, ['english_name', 'english', 'en']));
      const typ = str(field(r, ['type', 't'])).toLowerCase();
      if (id) {
        const e = find(id) || ensure(id, typ);
        touchName(e, r, typ);
        return;
      }
      const key = nameKey(en);
      if (!key) return;
      (D || []).forEach(e => {
        if (!e) return;
        const full = str(e.en).toLowerCase();
        if (full !== key && nameKey(e.en) !== key) return;
        if (hi) e.hi = hi;
        if (m) e.m = m;
        if (!isYes(r.enabled, true)) e._off = true;
      });
    });

    (pack.places || []).forEach(r => {
      const id = str(field(r, ['id']));
      if (!id) return;
      const e = find(id) || ensure(id, 'l');
      e.t = 'l';
      const hi = str(field(r, ['hindi_name', 'hi', 'hindi']));
      const m = str(field(r, ['hindi_meaning', 'meaning', 'm']));
      const en = str(field(r, ['english_name', 'english', 'en']));
      if (hi) e.hi = hi;
      if (m) e.m = m;
      if (en) e.en = en;
      const lat = num(field(r, ['lat', 'latitude']));
      const lon = num(field(r, ['lon', 'lng', 'longitude']));
      if (lat != null && lon != null) {
        e.ll = [lat, lon];
        if (Array.isArray(GEO)) {
          const g = GEO.find(x => x.id === e.id);
          if (g) g.ll = [lat, lon];
          else GEO.push({ id: e.id, hi: e.hi, en: e.en, ll: [lat, lon], hv: e.hv });
        }
      }
      const cat = str(field(r, ['category', 'ft', 'cat']));
      if (cat) e.ft = cat.toLowerCase();
      if (isYes(field(r, ['show_on_map_default', 'featured', 'show_default']), false)) e._featured = true;
      if (!isYes(r.enabled, true)) e._mapOff = true;
    });

    (pack.exceptions || []).forEach(r => {
      const id = str(field(r, ['id']));
      if (!id) return;
      const typ = str(field(r, ['type', 't'])).toLowerCase();
      const e = find(id) || ensure(id, typ || 'p');
      const hi = str(field(r, ['hindi_name', 'hindiname', 'hi', 'hindi']));
      const m = str(field(r, ['hindi_meaning', 'meaning', 'hindimeaning']));
      const en = str(field(r, ['english_name', 'english', 'en']));
      if (hi) e.hi = hi;
      if (m) e.m = m;
      if (en) e.en = e.en || en;
      if (!isYes(r.enabled, true)) e._off = true;
    });

    if (pack.journeys && pack.journeys.length) {
      const by = [];
      const idx = {};
      pack.journeys.forEach(r => {
        const jid = str(field(r, ['journey_id', 'journey', 'id']));
        if (!jid || !isYes(r.enabled, true)) return;
        if (idx[jid] == null) {
          idx[jid] = by.length;
          by.push({
            id: jid,
            title: str(field(r, ['english_name', 'title', 'english'])),
            hi: str(field(r, ['hindi_name', 'hi'])),
            label: str(field(r, ['english_label', 'label', 'short_english'])),
            approx: isYes(field(r, ['approx', 'approximate']), false),
            note: str(field(r, ['note'])),
            stops: []
          });
        }
        const j = by[idx[jid]];
        if (!j.title && str(field(r, ['english_name', 'title']))) j.title = str(field(r, ['english_name', 'title']));
        if (!j.hi && str(field(r, ['hindi_name', 'hi']))) j.hi = str(field(r, ['hindi_name', 'hi']));
        if (!j.label && str(field(r, ['english_label', 'label']))) j.label = str(field(r, ['english_label', 'label']));
        const pid = str(field(r, ['place_id', 'place']));
        const order = num(field(r, ['step_order', 'order', 'step'])) || (j.stops.length + 1);
        const pl = pid ? find(pid) : null;
        const g = Array.isArray(GEO) ? GEO.find(x => x.id === pid) : null;
        j.stops.push({
          id: pid,
          n: str(field(r, ['english_step', 'n', 'english'])) || (pl && (pl.en || pl.hi)) || pid,
          hi: str(field(r, ['hindi_step', 'hi_step'])) || (pl && pl.hi) || '',
          ll: (pl && pl.ll) || (g && g.ll) || null,
          order
        });
      });
      by.forEach(j => {
        j.stops.sort((a, b) => (a.order || 0) - (b.order || 0));
        if (j.label) result.journeyLab[j.id] = j.label;
        else if (j.title) result.journeyLab[j.id] = j.title;
      });
      C.journeys = by;
    }

    result.quiz = (pack.quiz || []).map(parseQuizRow).filter(q => q && q.enabled);

    const dayIds = [];
    const famousIds = [];
    (pack.featured || []).forEach(r => {
      const id = str(field(r, ['id']));
      if (!id || !isYes(r.enabled, true)) return;
      const kind = str(field(r, ['kind', 'type', 'category'])).toLowerCase();
      if (kind === 'name_of_day' || kind === 'name' || kind === 'day') dayIds.push(id);
      else if (kind === 'famous_place' || kind === 'place' || kind === 'famous') famousIds.push(id);
    });
    if (dayIds.length) result.dayIds = dayIds;
    if (famousIds.length) result.famousIds = famousIds;
    D.forEach(e => { if (e && e._featured && (!result.famousIds || result.famousIds.indexOf(e.id) < 0)) {
      if (!result.famousIds) result.famousIds = [];
      result.famousIds.push(e.id);
    }});
    result.texts = pack.texts || {};
    const th = result.texts;
    if (th.home_thought_hi || th.home_thought_ref || th.home_thought_tag) {
      result.thought = {
        hi: (th.home_thought_hi && (th.home_thought_hi.hi || th.home_thought_hi.en)) || '',
        ref: (th.home_thought_ref && (th.home_thought_ref.hi || th.home_thought_ref.en)) || '',
        tag: (th.home_thought_tag && (th.home_thought_tag.en || th.home_thought_tag.hi)) || ''
      };
    }
    return result;
  }

  const api = {
    parseCsv, colIndex, rowsToMaps, isYes, looksLikeCsv, gvizToRows,
    packFromTabRows, applyPack, parseQuizRow, str, baseName, nameKey
  };
  root.HNSheet = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
