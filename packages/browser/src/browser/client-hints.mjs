import { compareIdentity } from './identity.mjs'

const brands = value => Array.isArray(value) && value.length ? value.map(x => [x.brand, x.version]).sort((a, b) => a[0].localeCompare(b[0])) : null
const headerBrands = value => typeof value === 'string' ? brands([...value.matchAll(/"([^"\\]+)";v="([\d.]+)"/g)].map(([, brand, version]) => ({ brand, version }))) : null
const major = value => typeof value === 'string' && /^\d+(?:\.\d+)*$/.test(value) ? value.split('.')[0] : null
const quoted = value => typeof value === 'string' && /^"[^"\\]*"$/.test(value) ? value.slice(1, -1) : null

// Empty or unavailable Client Hints remain unknown; seeing a header is not a pass.
export function compareClientHints(main, headers, version) {
  const js = main.uaData, engineMajor = major(version)
  const chromium = js?.brands?.find(x => x.brand === 'Chromium')
  const fullChromium = js?.fullVersionList?.find(x => x.brand === 'Chromium')
  const expected = {
    brands: brands(js?.brands), mobile: js?.mobile, platform: js?.platform,
    fullVersionList: brands(js?.fullVersionList), platformVersion: js?.platformVersion,
    uaMajor: engineMajor, jsMajor: engineMajor, fullEngineVersion: version,
  }
  const observed = {
    brands: headerBrands(headers['sec-ch-ua']), mobile: headers['sec-ch-ua-mobile'] === '?1' ? true : headers['sec-ch-ua-mobile'] === '?0' ? false : null,
    platform: quoted(headers['sec-ch-ua-platform']), fullVersionList: headerBrands(headers['sec-ch-ua-full-version-list']), platformVersion: quoted(headers['sec-ch-ua-platform-version']),
    uaMajor: main.ua?.match(/Chrome\/(\d+)/)?.[1], jsMajor: major(chromium?.version), fullEngineVersion: fullChromium?.version,
  }
  return compareIdentity(expected, observed, { fields: Object.keys(expected) })
}
