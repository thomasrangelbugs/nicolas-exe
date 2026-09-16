// Read-only state export for the local test runner. Not loaded in production.
export function install(game) {
  window.__testReady = true;
}
