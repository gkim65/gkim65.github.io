// Light/dark theme toggle.
//
// Order of preference: an explicit choice saved in localStorage wins;
// otherwise follow the OS setting. The chosen theme lives in a
// data-theme attribute on <html>, which assets/style.css reads.
//
// Note: the inline snippet in each page's <head> sets the attribute
// BEFORE first paint to avoid a flash of the wrong theme. This file
// only handles the button and later changes.

(function () {
  var root = document.documentElement;
  var KEY = 'theme';

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function apply(theme) {
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    updateButton(theme);
  }

  function updateButton(theme) {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    var goingTo = theme === 'dark' ? 'light' : 'dark';
    // Label shows the current theme; aria-label says what clicking does.
    btn.textContent = theme === 'dark' ? 'dark' : 'light';
    btn.setAttribute('aria-label', 'Switch to ' + goingTo + ' theme');
  }

  function init() {
    updateButton(current());

    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = current() === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(KEY, next); } catch (e) { /* private mode */ }
        apply(next);
      });
    }

    // Track the OS setting, but only while the visitor hasn't chosen for themselves.
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function (e) {
        var saved = null;
        try { saved = localStorage.getItem(KEY); } catch (err) { /* ignore */ }
        if (!saved) apply(e.matches ? 'dark' : 'light');
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange); // older Safari
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
