// Filters the paper list when a scene region is hovered or clicked.
// Each .hot element in the SVG has a data-topic; each paper <li> has
// data-topics (space-separated). Clicking a region locks the filter;
// clicking again (or "Show all") clears it. Hover previews.

(function () {
  const hotspots = document.querySelectorAll('.hot');
  const papers = document.querySelectorAll('.paper-list li');
  const clearBtn = document.getElementById('clear-filter');
  let locked = null; // the currently clicked-locked topic, or null

  function apply(topic) {
    papers.forEach((li) => {
      const topics = (li.dataset.topics || '').split(/\s+/).filter(Boolean);
      const match = !topic || topics.includes(topic);
      li.classList.toggle('dim', !match);
    });
    hotspots.forEach((h) => {
      h.classList.toggle('active', topic && h.dataset.topic === topic);
    });
    clearBtn.hidden = !topic;
  }

  hotspots.forEach((h) => {
    const topic = h.dataset.topic;
    h.addEventListener('mouseenter', () => { if (!locked) apply(topic); });
    h.addEventListener('mouseleave', () => { if (!locked) apply(null); });
    h.addEventListener('click', () => {
      locked = (locked === topic) ? null : topic;
      apply(locked);
    });
    h.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        locked = (locked === topic) ? null : topic;
        apply(locked);
      }
    });
  });

  clearBtn.addEventListener('click', () => { locked = null; apply(null); });
})();
