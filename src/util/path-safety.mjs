import { isAbsolute, relative, sep } from 'node:path'

/** True when target is root itself or a descendant of root. */
export function inside(root, target) {
  const rel = relative(root, target)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}
