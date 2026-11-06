// Exhaustive browser journeys on shared CI: keep assertions, allow source-loading latency.
// The default quick-feedback configuration remains unchanged.
import base from './playwright.config.js';
export default {...base,timeout:120000,expect:{timeout:15000}};
