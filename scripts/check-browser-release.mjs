import { inspectPackage, runNpm } from './package-check.mjs'
const [pack] = runNpm(['pack', '--dry-run', '--json', '--ignore-scripts'])
console.log(JSON.stringify({ dryRun: true, ...inspectPackage(pack) }, null, 2))
