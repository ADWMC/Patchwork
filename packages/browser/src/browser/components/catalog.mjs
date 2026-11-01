// The catalog is shipped with the plugin. Installation never follows "latest".
export const DRIVER_VERSION = '1.64.1'
export const CAMOUFOX_SDK = '0.5.8'
export const CAMOUFOX_DRIVER = '1.62.0'
export const CAMOUFOX_RELEASE = 'v156.0.1-beta.36'
export const ALIASMODE_RELEASE = 'v155.0.8059.85-aliasmode.4'
export const ALIASMODE_BROWSER_VERSION = '155.0.8059.85'
// Official release-asset SHA256 values recorded on 2026-11-01. These are
// upstream metadata hashes, not signatures. Never substitute a rolling tag.
const CAMOUFOX_ASSETS = {
  'win32-x64': ['win.x86_64', 1311638126, '096fd4832a7a32f2aa7f7bdd07fe6253dda296cbe783acd7bc2c86cf5ae62031'],
  'win32-ia32': ['win.i686', 1297194809, 'fcc36bad090f5a1274b14fe2bbd7c3cf2173117f10ed83b8d4f3db521fecb127'],
  'linux-x64': ['lin.x86_64', 1294875941, '72637885ee67c93466ad377831c647192f8f08fb5c6fd9279de1320b49dd2b53'],
  'linux-arm64': ['lin.arm64', 1284863246, '8b5fd083721c807ee2a752265683482477105052fa0e21739388b527ae067c15'],
  'darwin-x64': ['mac.x86_64', 1297187860, 'abe133d2b1c7a8afe5a6af5f44adfd3169b16d4cc2268e99a81a41a6853f5782'],
  'darwin-arm64': ['mac.arm64', 1289762241, '0ad5663e40f4a2a836e28747256b79f39a5105905f1b244139a7a391f85fda32'],
}
export const COMPONENTS = Object.freeze({
  chromium: { name: '便携 Chromium', backend: 'chromium-portable', version: '156.0.8078.4-1248', driverVersion: DRIVER_VERSION, playwright: 'chromium-headless-shell', executable: /^(?:headless_shell\.exe|chrome-headless-shell(?:\.exe)?)$/, revision: '1248' },
  recorder: { name: '录像编码器', version: '1013', driverVersion: DRIVER_VERSION, playwright: 'ffmpeg', executable: /^ffmpeg-(?:win64\.exe|linux|mac)$/, revision: '1013' },
  camoufox: { name: 'Camoufox', backend: 'camoufox', version: CAMOUFOX_RELEASE, driverVersion: CAMOUFOX_DRIVER, sdkVersion: CAMOUFOX_SDK, executable: /^(?:camoufox\.exe|camoufox|firefox)$/ },
  aliasmode: { name: 'AliasMode 原生指纹内核（实验）', backend: 'aliasmode', version: ALIASMODE_RELEASE, driverVersion: DRIVER_VERSION, executable: /^chrome\.exe$/ },
})

export function componentSpec(id) {
  if (!Object.hasOwn(COMPONENTS, id)) throw new Error('Unknown component; choose chromium, recorder, camoufox or aliasmode')
  return { id, ...COMPONENTS[id] }
}

export function aliasmodeAsset(platform = process.platform, arch = process.arch) {
  if (platform !== 'win32' || arch !== 'x64') throw new Error('AliasMode component currently supports Windows x64 only; other platforms are not qualified')
  const name = `aliasmode-chromium-${ALIASMODE_BROWSER_VERSION}-windows-x64.zip`
  return { name, bytes: 203519527, sha256: 'cfea275e4b7f3274b701e64c0483b46cbf6cd12ead9a6cfda6ff77b2680e7a23', url: `https://github.com/aliasmode/aliasmode-chromium/releases/download/${ALIASMODE_RELEASE}/${name}` }
}

export function camoufoxAsset(platform = process.platform, arch = process.arch) {
  const asset = CAMOUFOX_ASSETS[`${platform}-${arch}`]
  if (!asset) throw new Error('Camoufox has no pinned download for this platform/architecture')
  const name = `camoufox-156.0.1-beta.36-${asset[0]}.zip`
  return { name, bytes: asset[1], sha256: asset[2], url: `https://github.com/daijro/camoufox/releases/download/${CAMOUFOX_RELEASE}/${name}` }
}
