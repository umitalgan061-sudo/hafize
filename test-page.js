const http = require('http');
const { JSDOM } = require('jsdom');

http.get('http://127.0.0.1:5176/', (res) => {
  let html = '';
  res.on('data', chunk => { html += chunk; });
  res.on('end', () => {
    try {
      const dom = new JSDOM(html, {
        runScripts: 'outside-only',
        resources: 'usable'
      });
      const { window } = dom;

      console.log('✓ HTML parsed successfully');
      console.log('✓ Body loaded:', !!window.document.body);
      console.log('✓ Scripts found:', window.document.querySelectorAll('script').length);

      // Check for inline errors
      const scripts = window.document.querySelectorAll('script');
      console.log('\nScripts:');
      scripts.forEach((s, i) => {
        if (s.src) console.log(`  ${i+1}. External: ${s.src}`);
        else console.log(`  ${i+1}. Inline: ${s.textContent.substring(0, 50)}...`);
      });
    } catch (e) {
      console.error('Error parsing HTML:', e.message);
    }
  });
}).on('error', (e) => {
  console.error('Connection error:', e.message);
});
