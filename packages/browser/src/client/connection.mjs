export function readConnectionMetadata() {
  const rows = [...document.querySelectorAll('script[data-patchwork-browser]')]
  for (const node of rows.reverse()) {
    try { const data = JSON.parse(node.textContent); if (data.browserPath && data.token) return data } catch { /* Try the previous owner. */ }
  }
  return null
}
