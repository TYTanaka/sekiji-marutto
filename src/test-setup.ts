// App-rendering tests assume a returning user who has already entered the
// app from the landing page, so the welcome gate is pre-dismissed.
try {
  localStorage.setItem('sekiji-entered-v1', '1');
} catch {
  // Storage unavailable in this environment; tests that need it set it up.
}
