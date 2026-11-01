import { randomInt } from 'node:crypto'
import { ALIASMODE_BROWSER_VERSION, ALIASMODE_RELEASE } from './components/catalog.mjs'

export const NATIVE_IDENTITY_SCHEMA = 'aliasmode-seed-v1'

export function createNativeIdentity() {
  return { schema: NATIVE_IDENTITY_SCHEMA, seed: String(randomInt(1, 0x100000000)), platform: 'windows', release: ALIASMODE_RELEASE }
}

export function validateNativeIdentity(identity) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity) || Object.keys(identity).sort().join(',') !== 'platform,release,schema,seed' || identity.schema !== NATIVE_IDENTITY_SCHEMA || identity.release !== ALIASMODE_RELEASE || identity.platform !== 'windows' || typeof identity.seed !== 'string' || !/^[1-9]\d{0,9}$/.test(identity.seed) || Number(identity.seed) > 0xffffffff) {
    throw new Error('Invalid or incompatible native fingerprint identity; create a new AliasMode environment')
  }
  return identity
}

export function nativeLaunchArgs(profile) {
  if (profile?.backend !== 'aliasmode' || profile.mode !== 'fingerprint' || profile.fingerprint) throw new Error('AliasMode requires a native fingerprint profile; JS samples cannot be mixed with this engine')
  const identity = validateNativeIdentity(profile.engineIdentity)
  if (typeof profile.locale !== 'string' || !/^[A-Za-z0-9-]{2,40}$/.test(profile.locale) || typeof profile.timezoneId !== 'string' || !/^[A-Za-z0-9_+./-]{1,100}$/.test(profile.timezoneId)) throw new Error('Invalid native environment locale/timezone')
  const screen = profile.screen
  if (!screen || !Number.isInteger(screen.width) || !Number.isInteger(screen.height) || screen.width < 240 || screen.width > 2560 || screen.height < 240 || screen.height > 1800) throw new Error('Invalid native environment screen')
  if (!Number.isFinite(profile.deviceScaleFactor) || profile.deviceScaleFactor < 1 || profile.deviceScaleFactor > 3) throw new Error('Invalid native environment pixel ratio')
  return [
    `--fingerprint=${identity.seed}`, `--fingerprint-platform=${identity.platform}`,
    `--fingerprint-locale=${profile.locale}`, `--fingerprint-timezone=${profile.timezoneId}`,
    `--fingerprint-screen-width=${screen.width}`, `--fingerprint-screen-height=${screen.height}`,
    // Pinned engine patch 0159 makes this override the seed's DPR in both
    // ScreenInfo and rendering; context emulation alone is insufficient.
    `--force-device-scale-factor=${profile.deviceScaleFactor}`,
    '--fingerprint-noise',
  ]
}

export function assertNativeEngineVersion(version) {
  if (version !== ALIASMODE_BROWSER_VERSION) throw new Error(`Native fingerprint engine version differs from the qualified ${ALIASMODE_BROWSER_VERSION} build; verify the optional component`)
}
