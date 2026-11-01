import { resolve } from 'node:path'

export function resolveInside(root, request) {
  return resolve(root, request)
}
