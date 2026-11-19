// Leonida Trophy Guide — tracker logic. Plain script, no libraries. The only
// network use is loading data/trophies.json once from this same folder.
// Progress lives in localStorage only.
(function () {
  'use strict';

  var STORE_KEY = 'gta6-trophy-guide-v1';
  var GRADE_RANK = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
  var KIND_NAMES = {
    story: 'Story', side: 'Side quests', activity: 'Activities',
    collectible: 'Collectibles', combat: 'Combat', robbery: 'Robberies',
    exploration: 'Exploration', money: 'Money & property',
    completion: '100% completion', misc: 'One-offs', platinum: 'Platinum'
  };

  var $ = function (id) { return document.getElementById(id); };
  var listEl = $('list');
  var searchEl = $('search');
  var gradeEl = $('grade');
  var kindEl = $('category');
  var statusEl = $('status');
  var sortEl = $('sort');
  var hideEl = $('hideSpoilers');
  var missableEl = $('missableOnly');
  var countEl = $('resultCount');
  var fillEl = $('progressFill');
  var totalEl = $('progressCount');
  var pctEl = $('progressPct');
  var gradesEl = $('gradeCounts');
  var nextEl = $('nextUp');

  var state = { trophies: [], earned: {}, shown: {} };

  function readStore() {
    var parsed = {};
    try { parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { parsed = {}; }
    if (Array.isArray(parsed.earned)) parsed.earned.forEach(function (id) { state.earned[id] = true; });
    if (Array.isArray(parsed.shown)) parsed.shown.forEach(function (id) { state.shown[id] = true; });
  }

  function writeStore() {
    var earnedIds = Object.keys(state.earned).map(Number).sort(function (a, b) { return a - b; });
    var shownIds = Object.keys(state.shown).map(Number).sort(function (a, b) { return a - b; });
    localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, earned: earnedIds, shown: shownIds }));
  }

  function cap(word) { return word.charAt(0).toUpperCase() + word.slice(1); }

  function make(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function refreshProgress() {
    var all = state.trophies.length;
    var done = state.trophies.filter(function (t) { return state.earned[t.id]; }).length;
    var pct = all ? Math.round((done / all) * 100) : 0;
    fillEl.style.width = pct + '%';
    totalEl.textContent = done + ' / ' + all;
    pctEl.textContent = pct + '%';
    gradesEl.textContent = ['platinum', 'gold', 'silver', 'bronze'].map(function (g) {
      var ofGrade = state.trophies.filter(function (t) { return t.grade === g; });
      var got = ofGrade.filter(function (t) { return state.earned[t.id]; }).length;
      return got + '/' + ofGrade.length + ' ' + g;
    }).join(' · ');
    var next = state.trophies.filter(function (t) { return t.grade !== 'platinum' && !state.earned[t.id]; })[0];
    nextEl.textContent = next
      ? 'Next up: ' + next.name + ' (' + cap(next.grade) + ')'
      : 'Every trophy earned — Leonida Legend!';
  }

  function visible(t) {
    var q = searchEl.value.trim().toLowerCase();
    if (q) {
      var hay = (t.name + ' ' + t.description + ' ' + t.guide + ' ' + (t.tip || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
    if (kindEl.value !== 'all' && t.category !== kindEl.value) return false;
    if (statusEl.value === 'earned' && !state.earned[t.id]) return false;
    if (statusEl.value === 'todo' && state.earned[t.id]) return false;
    if (missableEl.checked && !t.missable) return false;
    return true;
  }

  function ordered(list) {
    var out = list.slice();
    if (sortEl.value === 'name') out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else if (sortEl.value === 'grade') {
      out.sort(function (a, b) {
        return (GRADE_RANK[a.grade] - GRADE_RANK[b.grade]) || (a.id - b.id);
      });
    } else out.sort(function (a, b) { return a.id - b.id; });
    return out;
  }

  function sourceLink(t) {
    var line = make('p', 'source');
    line.appendChild(document.createTextNode('Source: '));
    var first = document.createElement('a');
    first.href = t.source_url;
    first.textContent = t.source + ' — GTA 6 Trophy Guide';
    first.target = '_blank';
    first.rel = 'noopener';
    line.appendChild(first);
    if (t.source2 && t.source2_url) {
      line.appendChild(document.createTextNode(' · also: '));
      var second = document.createElement('a');
      second.href = t.source2_url;
      second.textContent = t.source2;
      second.target = '_blank';
      second.rel = 'noopener';
      line.appendChild(second);
    }
    return line;
  }

  function buildCard(t) {
    var card = make('article', 'trophy' + (state.earned[t.id] ? ' done' : ''));
    card.id = 'trophy-' + t.id;

    var wrap = make('label', 'tick-wrap');
    wrap.title = state.earned[t.id] ? 'Mark as not earned' : 'Mark as earned';
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'tick';
    box.checked = !!state.earned[t.id];
    box.setAttribute('aria-label', 'Earned: ' + t.name);
    box.addEventListener('change', function () {
      if (box.checked) state.earned[t.id] = true; else delete state.earned[t.id];
      writeStore();
      refreshProgress();
      render();
    });
    wrap.appendChild(box);
    card.appendChild(wrap);

    var head = make('div', 'trophy-head');
    head.appendChild(make('h3', null, t.name));
    head.appendChild(make('span', 'tier tier-' + t.grade, cap(t.grade)));
    if (t.missable) head.appendChild(make('span', 'tag tag-missable', 'Missable'));
    if (!t.confirmed) head.appendChild(make('span', 'tag tag-unconfirmed', 'Unconfirmed'));
    if (t.spoiler) head.appendChild(make('span', 'tag tag-spoiler', 'Spoiler'));
    card.appendChild(head);

    var hidden = t.spoiler && hideEl.checked && !state.shown[t.id];
    var body = make('div', hidden ? 'spoiler-body' : null);
    body.style.display = 'contents';
    body.appendChild(make('p', 'official', '“' + t.description + '”'));
    body.appendChild(make('p', 'guide', t.guide));
    body.appendChild(make('p', 'tip', 'Tip: ' + t.tip));
    body.appendChild(sourceLink(t));
    card.appendChild(body);

    if (hidden) {
      var show = make('button', 'show-btn', 'Show spoiler');
      show.type = 'button';
      show.addEventListener('click', function () {
        state.shown[t.id] = true;
        writeStore();
        render();
        var fresh = document.getElementById('trophy-' + t.id);
        if (fresh) fresh.scrollIntoView({ block: 'nearest' });
      });
      card.appendChild(show);
      card.classList.add('hidden-spoiler');
    }
    return card;
  }

  function render() {
    var shown = ordered(state.trophies.filter(visible));
    listEl.replaceChildren();
    if (!shown.length) {
      listEl.appendChild(make('p', 'empty', 'No trophies match those filters.'));
    } else {
      shown.forEach(function (t) { listEl.appendChild(buildCard(t)); });
    }
    countEl.textContent = 'Showing ' + shown.length + ' of ' + state.trophies.length + ' trophies.';
    refreshProgress();
  }

  function downloadProgress() {
    var earnedIds = Object.keys(state.earned).map(Number).sort(function (a, b) { return a - b; });
    var payload = {
      app: 'gta6-trophy-guide',
      version: 1,
      exportedAt: new Date().toISOString(),
      earned: earnedIds
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gta6-trophy-progress.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function uploadProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        var ids = Array.isArray(data) ? data : data.earned;
        if (!Array.isArray(ids)) throw new Error('no earned list');
        var next = {};
        ids.forEach(function (id) {
          var n = Number(id);
          if (state.trophies.some(function (t) { return t.id === n; })) next[n] = true;
        });
        state.earned = next;
        writeStore();
        render();
      } catch (e) {
        alert('That file is not a trophy progress export.');
      }
    };
    reader.readAsText(file);
  }

  [searchEl, gradeEl, kindEl, statusEl, sortEl, hideEl, missableEl].forEach(function (input) {
    input.addEventListener('input', render);
    input.addEventListener('change', render);
  });
  $('exportBtn').addEventListener('click', downloadProgress);
  $('importFile').addEventListener('change', function () {
    var file = $('importFile').files[0];
    if (file) uploadProgress(file);
    $('importFile').value = '';
  });
  $('resetBtn').addEventListener('click', function () {
    if (window.confirm('Clear all earned trophies? This cannot be undone.')) {
      state.earned = {};
      writeStore();
      render();
    }
  });

  readStore();
  fetch('data/trophies.json')
    .then(function (r) { if (!r.ok) throw new Error('trophies.json not found'); return r.json(); })
    .then(function (doc) {
      state.trophies = doc.trophies || [];
      var params = new URLSearchParams(window.location.search);
      if (params.get('grade')) gradeEl.value = params.get('grade');
      if (params.get('category')) kindEl.value = params.get('category');
      if (params.get('hideSpoilers') === '0') hideEl.checked = false;
      render();
      var openId = Number(params.get('open') || 0);
      if (openId) {
        state.shown[openId] = true;
        render();
        var target = document.getElementById('trophy-' + openId);
        if (target) target.scrollIntoView({ block: 'center' });
      }
    })
    .catch(function () {
      listEl.replaceChildren();
      listEl.appendChild(make('p', 'empty', 'Could not load the trophy list.'));
    });
})();
