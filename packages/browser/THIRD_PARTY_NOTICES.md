# Third-party notices

The independent browser package uses `playwright-core@1.64.1` by Microsoft,
licensed under Apache-2.0. Its license notice is distributed with the installed
dependency; This package does not copy Playwright source into this repository.

Browser environment profiles use `fingerprint-generator@2.1.89` and
`fingerprint-injector@2.1.89` from Apify's fingerprint-suite, licensed under
Apache-2.0. License texts and dependency notices are distributed with their
installed packages. Full injection is gated by engine compatibility; the
default native/device environment does not apply an old browser UA sample.

The optional component installer uses `yauzl@3.2.0` by Josh Wolfe, licensed
under MIT. Its license is distributed with the installed dependency. Browser
and FFmpeg components retain the notices in their official runtime archives;
their licenses are independent of Patchwork's AGPL-3.0-only license. Camoufox
and its optional SDK dependencies are fetched only on explicit installation.

Binary frame transport uses `ws@8.22.0` (MIT). Its license is distributed with
the installed dependency. React, React DOM and clsx are development-only test
dependencies; the production client resolves React and DSH controls from the
host instead of bundling another copy.

The optional AliasMode Chromium component is downloaded only after an explicit
`install aliasmode` command. The qualified Windows x64 release is
`v155.0.8059.85-aliasmode.4` (Chromium `155.0.8059.85`), with upstream source at
<https://github.com/aliasmode/aliasmode-chromium/tree/3900a207abab317348c5c5c43adbaf0c2d47c725>.
The upstream repository identifies its license as GPL-3.0; Chromium and its
third-party components retain their own notices in the runtime archive. This
package does not relicense that runtime as AGPL or embed its binaries. Source,
license, archive SHA256, size and provenance are recorded in the download plan
and component manifest. The GitHub asset digest is an integrity check, not a
signature or a reproducible-build attestation. Preserve the runtime notices
and applicable source-distribution obligations when redistributing it.
