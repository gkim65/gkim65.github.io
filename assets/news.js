// Year filter for the news list.
//
// Reads the data-year on each list item, builds one button per year
// (newest first) next to the existing "All" button, and shows only the
// matching items when a year is picked. Adding a news item in a new
// year needs no changes here.

(function () {
  var nav = document.querySelector('.year-nav');
  var items = Array.prototype.slice.call(document.querySelectorAll('.news-list li'));
  if (!nav || !items.length) return;

  // Unique years, newest first.
  var years = items
    .map(function (li) { return li.dataset.year; })
    .filter(function (y, i, a) { return y && a.indexOf(y) === i; })
    .sort(function (a, b) { return Number(b) - Number(a); });

  years.forEach(function (y) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'year-btn';
    b.dataset.year = y;
    b.textContent = y;
    nav.appendChild(b);
  });

  function select(year) {
    items.forEach(function (li) {
      li.hidden = !(year === 'all' || li.dataset.year === year);
    });
    nav.querySelectorAll('.year-btn').forEach(function (b) {
      var on = b.dataset.year === year;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  nav.addEventListener('click', function (e) {
    var btn = e.target.closest('.year-btn');
    if (btn) select(btn.dataset.year);
  });
})();
