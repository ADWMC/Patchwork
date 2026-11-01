import { relative, resolve, sep } from 'node:path'

export function resolveInside(root, request) {
  const base = resolve(root)
  const target = resolve(base, request)
  const rest = relative(base, target)
  if (rest === '..' || rest.startsWith(`..${sep}`) || rest.includes(`..${sep}`) || (rest && /^[A-Za-z]:/.test(target) && !target.toLowerCase().startsWith(`${base.toLowerCase()}${sep}`))) throw new Error('PATH_OUTSIDE_ROOT')
  if (target !== base && !target.startsWith(`${base}${sep}`)) throw new Error('PATH_OUTSIDE_ROOT')
  return target
}
