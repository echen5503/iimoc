document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('problemMarkdown');

  marked.setOptions({
    highlight: function(code, lang) {
      try {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        }
        return hljs.highlightAuto(code).value;
      } catch {
        const div = document.createElement('div');
        div.textContent = code;
        return div.innerHTML;
      }
    }
  });

  try {
    const res = await fetch('../assets/problems/ahc001.md', { cache:'no-store' });
    if (!res.ok) throw new Error(`Markdown not found (${res.status})`);
    const md = await res.text();

    const rawHtml = marked.parse(md);
    const safeHtml = DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['class'] });
    container.innerHTML = safeHtml;

    container.querySelectorAll('pre code').forEach(block => {
      if (!block.classList.contains('hljs')) hljs.highlightElement(block);
    });

    if (window.MathJax && MathJax.typesetPromise) {
      await MathJax.typesetPromise([container]);
    }
  } catch (err) {
    console.error(err);
    container.textContent = '⚠️ Could not load problem statement.';
  }
});