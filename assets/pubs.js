// Year and area filters for the publication list.
//
// One filter is active at a time: picking a year clears the area and vice
// versa. With ~20 publications, combining them would narrow most pairs to
// one paper or an empty list.
//
//   year  — buttons built from each <li>'s data-year
//   area  — buttons built from data-areas; the inline tags are clickable too.
//           #area-nav lists the main areas (data-order); every other area
//           goes in #area-more.
//
// ?area=<key> in the URL preselects an area, so other pages can link to one
// grouping. Adding a publication needs no changes here, only data- attributes.

(function () {
  var yearNav = document.getElementById('year-nav');
  var areaNav = document.getElementById('area-nav');
  var moreNav = document.getElementById('area-more');
  var items = Array.prototype.slice.call(document.querySelectorAll('.pub-list li'));
  var empty = document.querySelector('.pub-empty');
  if (!yearNav || !areaNav || !items.length) return;

  var year = 'all';
  var area = 'all';

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

  function keys(nav) { return ((nav && nav.dataset.order) || '').split(/\s+/).filter(Boolean); }
  var mainAreas = keys(areaNav).filter(function (a) { return areas.indexOf(a) !== -1; });
  var moreOrder = keys(moreNav);
  function rank(a) { var i = moreOrder.indexOf(a); return i === -1 ? moreOrder.length : i; }
  var moreAreas = areas.filter(function (a) { return mainAreas.indexOf(a) === -1; })
    .map(function (a, i) { return [a, i]; })
    .sort(function (x, y) { return rank(x[0]) - rank(y[0]) || x[1] - y[1]; })
    .map(function (p) { return p[0]; });

  function addBtn(nav, key, value, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'year-btn';
    b.dataset[key] = value;
    b.textContent = label;
    nav.appendChild(b);
  }

  years.forEach(function (y) { addBtn(yearNav, 'year', y, y); });
  addBtn(areaNav, 'area', 'all', 'All');
  mainAreas.forEach(function (a) { addBtn(areaNav, 'area', a, areaLabels[a] || a); });
  if (moreNav) {
    moreAreas.forEach(function (a) { addBtn(moreNav, 'area', a, areaLabels[a] || a); });
    moreNav.closest('.filter-group').hidden = !moreAreas.length;
  }

  function apply() {
    var shown = 0;
    items.forEach(function (li) {
      var areaList = (li.dataset.areas || '').split(/\s+/).filter(Boolean);
      var ok = area !== 'all' ? areaList.indexOf(area) !== -1
             : year !== 'all' ? li.dataset.year === year
             : true;
      li.hidden = !ok;
      if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;

    yearNav.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.year === year && area === 'all');
    });
    document.querySelectorAll('.pub-filters [data-area]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.area === area && (area !== 'all' || year === 'all'));
    });
    document.querySelectorAll('.pub-list .tag').forEach(function (t) {
      t.classList.toggle('is-active', area !== 'all' && t.dataset.area === area);
    });
    document.dispatchEvent(new CustomEvent('pubs:area', { detail: { area: area } }));
  }

  function pickYear(v) { year = v; area = 'all'; apply(); }
  function pickArea(v) { area = v; year = 'all'; apply(); }

  yearNav.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) pickYear(b.dataset.year);
  });
  [areaNav, moreNav].forEach(function (nav) {
    if (!nav) return;
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) pickArea(b.dataset.area);
    });
  });
  // A tile in the "All" grid of area visuals (assets/area-visuals.js).
  document.addEventListener('pubs:pick', function (e) { pickArea(e.detail.area); });

  document.querySelector('.pub-list').addEventListener('click', function (e) {
    var t = e.target.closest('.tag');
    if (!t) return;
    pickArea(area === t.dataset.area ? 'all' : t.dataset.area);
  });

  var urlArea = new URLSearchParams(window.location.search).get('area');
  if (urlArea && areas.indexOf(urlArea) !== -1) area = urlArea;

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
