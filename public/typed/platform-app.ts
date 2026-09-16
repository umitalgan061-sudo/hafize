import './platform-runtime.ts';
import './platform-dashboard-static.ts';
import './app-runtime.ts';

export const HAFIZE_TYPED_PLATFORM_ENTRY = Object.freeze({
  name: 'hafize-platform',
  version: 1,
  modules: Object.freeze(['platform-runtime', 'platform-dashboard-static', 'app-runtime'])
});
