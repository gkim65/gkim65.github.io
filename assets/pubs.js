// Year / area / scene filters for the publication list.
//
// ONE filter is active at a time — selecting in any group clears the other
// two. With ~11 publications, combining filters would narrow most pairs to
// a single paper or an empty list, so peer filters are both simpler to
// reason about and impossible to dead-end.
//
//   year   — buttons built from each <li>'s data-year
//   area   — buttons built from data-areas; the inline tags are clickable too
//   topic  — hovering/clicking a region of the SVG scene, via data-topics
//
// Adding a publication needs no changes here; only the data- attributes.
//
// TODO revisit past ~40 publications: combining filters (year AND area)
// starts to earn its keep at that size. It was tried at 11 papers and 10
// of the 20 year x area pairs came back empty, which just produces dead
// ends. To switch back, make the `ok` expression in apply() below AND the
// three conditions together instead of picking the first active one — and
// add an empty-state message naming which filters conflict.

(function () {
  var yearNav = document.getElementById('year-nav');
  var areaNav = document.getElementById('area-nav');
  var items = Array.prototype.slice.call(document.querySelectorAll('.pub-list li'));
  var empty = document.querySelector('.pub-empty');
  var note = document.getElementById('scene-note');
  var hotspots = Array.prototype.slice.call(document.querySelectorAll('.hot'));
  if (!yearNav || !areaNav || !items.length) return;

  var year = 'all';
  var area = 'all';
  var topic = null;        // hover preview, or locked by a click
  var lockedTopic = null;

  // Labels come from the tags already in the markup, so the buttons and
  // the inline tags can never disagree.
  var areaLabels = {};
  items.forEach(function (li) {
    li.querySelectorAll('.tag').forEach(function (t) {
      areaLabels[t.dataset.area] = t.textContent.trim();
    });
  });

  var years = items.map(function (li) { return li.dataset.year; })
    .filter(function (y, i, a) { return y && a.indexOf(y) === i; })
    .sort(function (a, b) { return Number(b) - Number(a); });

  var areas = items.reduce(function (acc, li) {
    (li.dataset.areas || '').split(/\s+/).filter(Boolean).forEach(function (a) {
      if (acc.indexOf(a) === -1) acc.push(a);
    });
    return acc;
  }, []);

  function addBtn(nav, key, value, label, active) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'year-btn' + (active ? ' is-active' : '');
    b.dataset[key] = value;
    b.textContent = label;
    nav.appendChild(b);
    return b;
  }

  years.forEach(function (y) { addBtn(yearNav, 'year', y, y, false); });
  addBtn(areaNav, 'area', 'all', 'All', true);
  areas.forEach(function (a) { addBtn(areaNav, 'area', a, areaLabels[a] || a, false); });

  function apply() {
    var active = lockedTopic || topic;
    var shown = 0;

    items.forEach(function (li) {
      var areaList = (li.dataset.areas || '').split(/\s+/).filter(Boolean);
      var topicList = (li.dataset.topics || '').split(/\s+/).filter(Boolean);
      // Exactly one of these is ever narrowing — see the note at the top.
      // This is the line to change for AND behaviour (see the ~40-paper
      // TODO); the filters themselves already track independent state.
      var ok = active ? topicList.indexOf(active) !== -1
             : area !== 'all' ? areaList.indexOf(area) !== -1
             : year !== 'all' ? li.dataset.year === year
             : true;
      li.hidden = !ok;
      if (ok) shown++;
    });

    if (empty) empty.hidden = shown > 0;

    yearNav.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.year === year);
    });
    areaNav.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.area === area);
    });
    document.querySelectorAll('.pub-list .tag').forEach(function (t) {
      t.classList.toggle('is-active', area !== 'all' && t.dataset.area === area);
    });
    hotspots.forEach(function (h) {
      h.classList.toggle('active', !!active && h.dataset.topic === active);
    });

    if (note) {
      if (active) {
        note.hidden = false;
        note.textContent = 'Showing ' + active.replace(/-/g, ' ') + ' work' +
          (lockedTopic ? ' — click the region again to clear' : '');
      } else {
        note.hidden = true;
      }
    }
  }

  // Selecting in one group resets the other two, so only one filter is
  // ever narrowing the list.
  function pickYear(v) { year = v; area = 'all'; lockedTopic = null; topic = null; apply(); }
  function pickArea(v) { area = v; year = 'all'; lockedTopic = null; topic = null; apply(); }
  function pickTopic(v) { lockedTopic = v; topic = null; year = 'all'; area = 'all'; apply(); }

  yearNav.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) pickYear(b.dataset.year);
  });
  areaNav.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) pickArea(b.dataset.area);
  });
  document.querySelector('.pub-list').addEventListener('click', function (e) {
    var t = e.target.closest('.tag');
    if (!t) return;
    pickArea(area === t.dataset.area ? 'all' : t.dataset.area);
  });

  // Scene: hover previews (without disturbing a click-locked selection),
  // click locks and clears the button filters.
  hotspots.forEach(function (h) {
    var t = h.dataset.topic;
    h.addEventListener('mouseenter', function () { if (!lockedTopic) { topic = t; apply(); } });
    h.addEventListener('mouseleave', function () { if (!lockedTopic) { topic = null; apply(); } });
    h.addEventListener('click', function () {
      pickTopic(lockedTopic === t ? null : t);
    });
    h.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pickTopic(lockedTopic === t ? null : t);
      }
    });
  });

  apply();

  // BibTeX: each toggle expands the <pre class="bib"> in its own entry,
  // with a copy button appended once on first open.
  document.querySelectorAll('.bib-toggle').forEach(function (btn) {
    var wrap = btn.closest('li').querySelector('.bib-wrap');
    if (!wrap) return;
    btn.addEventListener('click', function () {
      var open = !wrap.hidden;
      wrap.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));
      btn.classList.toggle('is-open', !open);
      if (!open && !wrap.querySelector('.bib-copy')) addCopy(wrap.querySelector('.bib'));
    });
  });

  function addCopy(pre) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bib-copy';
    b.textContent = 'copy';
    b.addEventListener('click', function () {
      var text = pre.querySelector('code').textContent;
      var done = function () {
        b.textContent = 'copied';
        setTimeout(function () { b.textContent = 'copy'; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        // execCommand is deprecated but still the only option on
        // non-secure origins, where navigator.clipboard is undefined.
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { b.textContent = 'select & copy'; }
        document.body.removeChild(ta);
      }
    });
    // Anchored to the wrapper, not the <pre> — a button inside a
    // horizontally scrolling box would slide out of view with the text.
    pre.parentNode.appendChild(b);
  }
})();
