// Optional capability rendezvous: no browser imports or runtime dependencies in
// the main package. The provider belongs to one live authorized Agent instance.
const key = Symbol.for('@patchwork/browser/retrieval/v1')
export async function browserRetrieve(agent, options) {
  const provider = globalThis[key]?.get(agent)
  if (!provider) { const error = new Error('Enable the optional browser for this session before using transport=browser'); error.code = 'FETCH_BROWSER_UNAVAILABLE'; throw error }
  return provider(options)
}
