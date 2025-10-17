// Lightweight markdown renderer using markdown-it and DOMPurify from CDN
// Exposes window.renderMarkdown(selector) and auto-renders elements with [data-markdown]
(function () {
  var MD_CDN = 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js';
  var DOMPURIFY_CDN = 'https://cdn.jsdelivr.net/npm/dompurify@2.4.0/dist/purify.min.js';

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = cb;
    s.onerror = function () { console.error('Failed to load', src); cb(new Error('load error')); };
    document.head.appendChild(s);
  }

  function ready(cb) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb);
    else cb();
  }

  function setupRenderer() {
    if (!window.markdownit) {
      console.warn('markdown-it not loaded');
      return null;
    }
    if (!window.DOMPurify) {
      console.warn('DOMPurify not loaded');
      return null;
    }

    var md = window.markdownit({ html: true, linkify: true, typographer: true });

    function render(el) {
      var src = el.getAttribute('data-markdown') || el.textContent || '';
      try {
        var html = md.render(src);
        // sanitize
        var safe = window.DOMPurify.sanitize(html, {ADD_ATTR: ['target']});
        el.innerHTML = safe;
      } catch (err) {
        console.error('Markdown render error', err);
      }
    }

    window.renderMarkdown = function (selector) {
      var nodes;
      if (!selector) nodes = document.querySelectorAll('[data-markdown]');
      else nodes = document.querySelectorAll(selector);
      nodes.forEach(function (el) { render(el); });
    };

    // auto-render elements with data-markdown
    ready(function () { window.renderMarkdown(); });

    return true;
  }

  // Load both scripts sequentially (markdown-it then DOMPurify)
  loadScript(MD_CDN, function (err) {
    if (err) return;
    loadScript(DOMPURIFY_CDN, function (err2) {
      if (err2) return;
      try { setupRenderer(); } catch (e) { console.error(e); }
    });
  });
  document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('problemMarkdown');
  if (container && window.PROBLEM_MARKDOWN) {
    // Using marked.js or showdown.js (whichever you’re including)
    container.innerHTML = marked.parse(window.PROBLEM_MARKDOWN);
  }
});

})();
