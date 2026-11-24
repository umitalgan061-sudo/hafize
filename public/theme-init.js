// Applies the saved theme before first paint. ui-shell.ts (a deferred module) owns the theme
// afterwards; without this, dark-mode users saw a light frame on every load. Same rule as
// resolveTheme(): a stored "dark"/"light" wins, otherwise follow the system setting.
(function () {
  var theme = 'light';
  try {
    var saved = localStorage.getItem('hafize.theme.v1');
    if (saved === 'dark' || saved === 'light') theme = saved;
    else if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  } catch (e) {}
  document.documentElement.dataset.theme = theme;
  // Start with the stable focused layout; only an explicit new preference enables advanced mode.
  var layout = 'focused';
  try {
    if (localStorage.getItem('hafize.ui-layout.v2') === 'classic') layout = 'classic';
  } catch (e) {}
  document.documentElement.dataset.hafizeLayout = layout;
})();
