// Leonida Trophy Guide — tracker logic. Plain script, no libraries, no network
// beyond loading data/trophies.json once. Progress lives in localStorage only.
(function () {
  'use strict';

  var KEY = 'gta6-trophy-guide-v1';
  var GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
  var CATEGORY_LABELS = {
    story: 'Story', side: 'Side quests', activity: 'Activities',
    collectible: 'Collectibles', combat: 'Combat', robbery: 'Robberies',
    exploration: 'Exploration', money: 'Money & property',
    completion: '100% completion', misc: 'One-offs', platinum: 'Platinum'
  };

  var listEl = document.getElementById('list');
  var searchEl = document.getElementById('search');
  var gradeEl = document.getElementById('grade');
  var categoryEl = document.getElementById('category');
  var statusEl = document.getElementById('status');
  var sortEl = document.getElementById('sort');
  var hideSpoilersEl = document.getElementById('hideSpoilers');
  var missableOnlyEl = document.getElementById('missableOnly');
  var resultCountEl = document.getElementById('resultCount');
  var progressFillEl = document.getElementById('progressFill');
  var progressCountEl = document.getElementById('progressCount');
  var progressPctEl = document.getElementById('progressPct');
  var gradeCountsEl = document.getElementById('gradeCounts');
  var exportBtn = document.getElementById('exportBtn');
  var importFile = document.getElementById('importFile');
  var resetBtn = document.getElementById('resetBtn');

  var trophies = [];
  var earned = {};
  var revealed = {};

  function loadState() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (Array.isArray(raw.earned)) raw.earned.forEach(function (id) { earned[id] = true; });
      if (Array.isArray(raw.revealed)) raw.revealed.forEach(function (id) { revealed[id] = true; });
    } catch (e) { /* corrupt state: start fresh */ }
  }

  function saveState() {
    var earnedIds = Object.keys(earned).map(Number).sort(function (a, b) { return a - b; });
    var revealedIds = Object.keys(revealed).map(Number).sort(function (a, b) { return a - b; });
    localStorage.setItem(KEY, JSON.stringify({ v: 1, earned: earnedIds, revealed: revealedIds }));
  }

  function gradeLabel(grade) {
    return grade.charAt(0).toUpperCase() + grade.slice(1);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function updateProgress() {
    var total = trophies.length;
    var done = trophies.filter(function (t) { return earned[t.id]; }).length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    progressFillEl.style.width = pct + '%';
    progressCountEl.textContent = done + ' / ' + total;
    progressPctEl.textContent = pct + '%';
    var parts = ['platinum', 'gold', 'silver', 'bronze'].map(function (g) {
      var all = trophies.filter(function (t) { return t.grade === g; }).length;
      var got = trophies.filter(function (t) { return t.grade === g && earned[t.id]; }).length;
      return got + '/' + all + ' ' + g;
    });
    gradeCountsEl.textContent = parts.join(' · ');
  }

  function matches(t) {
    var q = searchEl.value.trim().toLowerCase();
    if (q) {
      var hay = (t.name + ' ' + t.description + ' ' + t.guide + ' ' + (t.tip || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
    if (categoryEl.value !== 'all' && t.category !== categoryEl.value) return false;
    if (statusEl.value === 'earned' && !earned[t.id]) return false;
    if (statusEl.value === 'todo' && earned[t.id]) return false;
    if (missableOnlyEl.checked && !t.missable) return false;
    return true;
  }

  function sorted(list) {
    var out = list.slice();
    if (sortEl.value === 'name') {
      out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    } else if (sortEl.value === 'grade') {
      out.sort(function (a, b) {
        return (GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade]) || (a.id - b.id);
      });
    } else {
      out.sort(function (a, b) { return a.id - b.id; });
    }
    return out;
  }

  function renderCard(t) {
    var card = el('article', 'card' + (earned[t.id] ? ' earned' : ''));
    card.id = 'trophy-' + t.id;

    var checkWrap = el('label', 'check-label');
    checkWrap.title = earned[t.id] ? 'Mark as not earned' : 'Mark as earned';
    var check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'trophy-check';
    check.checked = !!earned[t.id];
    check.setAttribute('aria-label', 'Earned: ' + t.name);
    check.addEventListener('change', function () {
      if (check.checked) earned[t.id] = true; else delete earned[t.id];
      saveState();
      updateProgress();
      render();
    });
    checkWrap.appendChild(check);
    card.appendChild(checkWrap);

    var head = el('div', 'card-head');
    var title = el('h3', null, t.name);
    head.appendChild(title);
    var badge = el('span', 'grade-badge grade-' + t.grade, gradeLabel(t.grade));
    head.appendChild(badge);
    if (t.missable) head.appendChild(el('span', 'flag flag-missable', 'Missable'));
    if (!t.confirmed) head.appendChild(el('span', 'flag flag-unconfirmed', 'Unconfirmed'));
    if (t.spoiler) head.appendChild(el('span', 'flag flag-spoiler', 'Spoiler'));
    card.appendChild(head);

    var hidden = t.spoiler && hideSpoilersEl.checked && !revealed[t.id];
    var body = el('div', hidden ? 'spoiler-text' : null);
    body.style.display = 'contents';
    var official = el('p', 'official', '“' + t.description + '”');
    var guide = el('p', 'guide', t.guide);
    var tip = el('p', 'tip', 'Tip: ' + t.tip);
    var source = el('p', 'source');
    source.appendChild(document.createTextNode('Source: '));
    var link = document.createElement('a');
    link.href = t.source_url;
    link.textContent = t.source + ' — GTA 6 Trophy Guide';
    link.target = '_blank';
    link.rel = 'noopener';
    source.appendChild(link);
    body.appendChild(official);
    body.appendChild(guide);
    body.appendChild(tip);
    body.appendChild(source);
    card.appendChild(body);

    if (hidden) {
      var reveal = el('button', 'reveal-btn', 'Show spoiler');
      reveal.type = 'button';
      reveal.addEventListener('click', function () {
        revealed[t.id] = true;
        saveState();
        render();
        var fresh = document.getElementById('trophy-' + t.id);
        if (fresh) fresh.scrollIntoView({ block: 'nearest' });
      });
      card.appendChild(reveal);
      card.classList.add('spoiled');
    }
    return card;
  }

  function render() {
    var shown = sorted(trophies.filter(matches));
    listEl.replaceChildren();
    if (!shown.length) {
      listEl.appendChild(el('p', 'empty', 'No trophies match those filters.'));
    } else {
      shown.forEach(function (t) { listEl.appendChild(renderCard(t)); });
    }
    resultCountEl.textContent = 'Showing ' + shown.length + ' of ' + trophies.length + ' trophies.';
    updateProgress();
  }

  function exportProgress() {
    var earnedIds = Object.keys(earned).map(Number).sort(function (a, b) { return a - b; });
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

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        var ids = Array.isArray(data) ? data : data.earned;
        if (!Array.isArray(ids)) throw new Error('no earned list');
        var next = {};
        ids.forEach(function (id) {
          var n = Number(id);
          if (trophies.some(function (t) { return t.id === n; })) next[n] = true;
        });
        earned = next;
        saveState();
        render();
      } catch (e) {
        alert('That file is not a trophy progress export.');
      }
    };
    reader.readAsText(file);
  }

  [searchEl, gradeEl, categoryEl, statusEl, sortEl, hideSpoilersEl, missableOnlyEl]
    .forEach(function (input) {
      input.addEventListener('input', render);
      input.addEventListener('change', render);
    });
  exportBtn.addEventListener('click', exportProgress);
  importFile.addEventListener('change', function () {
    if (importFile.files.length) importProgress(importFile.files[0]);
    importFile.value = '';
  });
  resetBtn.addEventListener('click', function () {
    if (window.confirm('Clear all earned trophies? This cannot be undone.')) {
      earned = {};
      saveState();
      render();
    }
  });

  loadState();
  fetch('data/trophies.json')
    .then(function (r) { if (!r.ok) throw new Error('trophies.json not found'); return r.json(); })
    .then(function (doc) {
      trophies = doc.trophies || [];
      var params = new URLSearchParams(window.location.search);
      if (params.get('grade')) gradeEl.value = params.get('grade');
      if (params.get('category')) categoryEl.value = params.get('category');
      if (params.get('hideSpoilers') === '0') hideSpoilersEl.checked = false;
      render();
      var openId = Number(params.get('open') || 0);
      if (openId) {
        revealed[openId] = true;
        render();
        var target = document.getElementById('trophy-' + openId);
        if (target) target.scrollIntoView({ block: 'center' });
      }
    })
    .catch(function () {
      listEl.replaceChildren();
      listEl.appendChild(el('p', 'empty', 'Could not load the trophy list.'));
    });
})();
