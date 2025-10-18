
/* Lightweight markdown renderer with syntax highlighting (markdown-it + DOMPurify + highlight.js)
   Exposes window.renderMarkdown(selector) and auto-renders elements with [data-markdown] */
(function () {
  var MD_CDN = 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js';
  var DOMPURIFY_CDN = 'https://cdn.jsdelivr.net/npm/dompurify@2.4.0/dist/purify.min.js';

  // ✅ Use the browser (UMD) build of highlight.js (no require())
  var HLJS_JS  = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js';
  var HLJS_CSS = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github.min.css';
  // (Swap the CSS file for a different theme if you like.)

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = function(){ cb && cb(); };
    s.onerror = function () { console.error('Failed to load', src); cb && cb(new Error('load error')); };
    document.head.appendChild(s);
  }

  function loadCSS(href) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  function ready(cb) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb);
    else cb();
  }

  function makeHighlighter() {
    var hljs = window.hljs;
    // Return a highlight function compatible with markdown-it and marked.
    return function highlight(code, lang) {
      try {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        }
        // Fallback to auto-detect
        return hljs.highlightAuto(code).value;
      } catch (e) {
        // On error, escape HTML so it’s safe
        var div = document.createElement('div');
        div.textContent = code;
        return div.innerHTML;
      }
    };
  }

  function setupMarkdownIt() {
    if (!window.markdownit || !window.DOMPurify) {
      console.warn('markdown-it or DOMPurify not loaded; skipping markdown-it setup');
      return null;
    }

    var highlight = window.hljs ? makeHighlighter() : null;

    var md = window.markdownit({
      html: true,
      linkify: true,
      typographer: true,
      highlight: highlight
        ? function (str, lang) {
            var highlighted = highlight(str, lang);
            var cls = 'hljs' + (lang ? ' language-' + lang : '');
            return '<pre><code class="' + cls + '">' + highlighted + '</code></pre>';
          }
        : undefined
    });

    function render(el) {
      var src = el.getAttribute('data-markdown') || el.textContent || '';
      try {
        var html = md.render(src);
        // Keep things safe; allow 'class' so hljs classes stick around.
        var safe = window.DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'class'] });
        el.innerHTML = safe;

        // If we didn't inject highlighted HTML (e.g., highlight fn missing), do a pass:
        if (!window.hljs) return;
        el.querySelectorAll('pre code').forEach(function (block) {
          // If already highlighted (has hljs class), skip
          if (!block.classList.contains('hljs')) window.hljs.highlightElement(block);
        });
      } catch (err) {
        console.error('Markdown render error', err);
      }
    }

    window.renderMarkdown = function (selector) {
      var nodes = selector ? document.querySelectorAll(selector)
                           : document.querySelectorAll('[data-markdown]');
      nodes.forEach(function (el) { render(el); });
    };

    ready(function () { window.renderMarkdown(); });
    return true;
  }

  // Optional: if you use "marked" elsewhere, give it the same highlighter.
  function setupMarkedIfPresent() {
    if (!window.marked) return;
    var hl = window.hljs ? makeHighlighter() : null;
    if (hl) {
      window.marked.setOptions({
        highlight: function(code, lang) { return hl(code, lang); },
        // Don’t sanitize here; DOMPurify will handle it when injecting.
      });
    }
  }

  // Auto-render #problemMarkdown if window.PROBLEM_MARKDOWN exists (your original behavior)
  function setupProblemMarkdownAutoMount() {
    document.addEventListener('DOMContentLoaded', function () {
      var container = document.getElementById('problemMarkdown');
      if (container && window.PROBLEM_MARKDOWN && window.marked) {
        var raw = window.marked.parse(window.PROBLEM_MARKDOWN); // highlighted if setupMarkedIfPresent ran
        // Sanitize before inserting
        var safe = window.DOMPurify ? window.DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'class'] }) : raw;
        container.innerHTML = safe;

        // Ensure highlight in case marked didn't inject classes
        if (window.hljs) {
          container.querySelectorAll('pre code').forEach(function (block) {
            if (!block.classList.contains('hljs')) window.hljs.highlightElement(block);
          });
        }
      }
    });
  }

  // Load order: highlight.css -> markdown-it -> DOMPurify -> highlight.js -> init
  loadCSS(HLJS_CSS);
  loadScript(MD_CDN, function () {
    loadScript(DOMPURIFY_CDN, function () {
      loadScript(HLJS_JS, function () {
        try {
          setupMarkdownIt();
          setupMarkedIfPresent();
          setupProblemMarkdownAutoMount();
        } catch (e) {
          console.error(e);
        }
      });
    });
  });
})();
