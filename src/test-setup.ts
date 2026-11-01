// App-rendering tests open the production shell directly via its URL (#/app).
// In the test environment the cloud is disabled, so the auth gate passes.
try {
  window.location.hash = '#/app';
} catch {
  // Hash unavailable in this environment; tests that need it set it up.
}
