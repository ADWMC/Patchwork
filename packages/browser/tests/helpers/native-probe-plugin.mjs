import { createBrowserManager } from '../../src/index.mjs'
import { launchBackend } from '../../src/browser/backends.mjs'
import { BrowserResources } from '../../src/browser/resources.mjs'

export const name = 'native-browser-acceptance-probe'
export const inject = ['tools', 'agents', 'agentPresets']
export let manager, resources
export const engines = []
export let peakEngines = 0
let failNext = false
export function failNextLaunch() { failNext = true }
export function apply(ctx, config) {
  resources = new BrowserResources()
  manager = createBrowserManager(ctx, { maxInstances: 2 }, {
    root: config.root,
    componentRoot: config.componentRoot,
    resources,
    launch: async options => {
      if (failNext) { failNext = false; throw new Error('Injected native launch failure') }
      const browser = await launchBackend(options)
      engines.push({ browser, profileId: options.nativeProfile?.id })
      peakEngines = Math.max(peakEngines, engines.filter(x => x.browser.isConnected()).length)
      return browser
    },
  })
  ctx.effect(() => async () => { await manager.dispose(); resources.dispose() }, 'native browser acceptance cleanup')
}
