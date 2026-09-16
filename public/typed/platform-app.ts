import './platform-runtime.ts';
import './platform-dashboard-static.ts';
import './platform-styles.ts';
import './platform-events.ts';
import './platform-performance.ts';
import './platform-diagnostics.ts';
import './app-runtime.ts';

export const HAFIZE_TYPED_PLATFORM_ENTRY = Object.freeze({
  name: 'hafize-platform',
  version: 2,
  modules: Object.freeze([
    'platform-runtime',
    'platform-dashboard-static',
    'platform-styles',
    'platform-events',
    'platform-performance',
    'platform-diagnostics',
    'app-runtime'
  ])
});
