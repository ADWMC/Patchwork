// Compatibility entry point; requires explicit DSH_HOME or --home.
process.argv.splice(2, 0, 'install', 'recorder')
await import('./browser-components.mjs')
