// Browser stub for "node:module".
// @bcts/provenance-mark's base64 helpers use createRequire as a Node fallback.
// In the browser btoa/atob are always available, so this path is never reached.
export function createRequire() {
  return function () {
    throw new Error('require is not available in the browser')
  }
}
