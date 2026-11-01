import { randomUUID } from 'node:crypto'
import { digest, imageSize, observation } from './evidence.mjs'

const MAX_ITEMS = 8, MAX_BYTES = 8 * 1024 * 1024

// Read the page's real hit-test result; never dispatch mouse events or add DOM overlays.
export async function inspectElement(page, point) {
  const target = await page.evaluate(({ x, y }) => {
    let element = document.elementFromPoint(x, y)
    for (let depth = 0; depth < 20; depth++) {
      const inner = element?.shadowRoot?.elementFromPoint(x, y)
      if (!inner || inner === element) break
      element = inner
    }
    if (!element) return null
    const rect = element.getBoundingClientRect(), css = getComputedStyle(element)
    const box = { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: Math.min(innerWidth, rect.right) - Math.max(0, rect.x), height: Math.min(innerHeight, rect.bottom) - Math.max(0, rect.y) }
    if (box.width < 1 || box.height < 1) return null
    const tag = element.tagName.toLowerCase()
    const selector = (tag + (element.id ? '#' + CSS.escape(element.id) : '') + [...element.classList].slice(0, 3).map(name => '.' + CSS.escape(name)).join('')).slice(0, 180)
    const edges = prefix => Object.fromEntries(['top', 'right', 'bottom', 'left'].map(side => [side, Math.max(0, parseFloat(css.getPropertyValue(prefix + '-' + side)) || 0)]))
    return { tag, selector, role: element.getAttribute('role') || '', name: (element.getAttribute('aria-label') || element.getAttribute('alt') || element.innerText || '').replace(/\s+/g, ' ').slice(0, 160), box, size: { width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10 }, padding: edges('padding'), frameBoundary: tag === 'iframe' }
  }, { x: point.x, y: point.y })
  return target ? { ...target, targetId: digest(JSON.stringify(target)) } : null
}

export function selectionBox(input, viewport) {
  const box = input?.box
  if (!box || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(box[key]))) throw new Error('Invalid annotation selection')
  if (box.x < 0 || box.y < 0 || box.width < 1 || box.height < 1 || box.x + box.width > viewport.width || box.y + box.height > viewport.height) throw new Error('Annotation selection is outside the viewport')
  const x = Math.floor(box.x), y = Math.floor(box.y)
  return { x, y, width: Math.min(viewport.width, Math.ceil(box.x + box.width)) - x, height: Math.min(viewport.height, Math.ceil(box.y + box.height)) - y }
}

export class BrowserAnnotations {
  constructor(session) { this.session = session; this.items = new Map() }
  clear() { this.items.clear() }
  summaries(forUser = false) {
    const session = this.session
    return [...this.items.values()].filter(item => forUser || item.submitted).map(({ image, page, fingerprint, generation, ...item }) => ({ ...item, stale: generation !== session.annotationGeneration || page !== session.page() }))
  }
  async inspect(args) {
    const s = this.session
    s.check(); s.validateFrame(args)
    const page = s.page(), epoch = s.epoch
    const box = selectionBox(args, page.viewportSize())
    const target = await inspectElement(page, box)
    s.check(); s.validateFrame(args)
    if (s.page() !== page || epoch !== s.epoch) throw new Error('页面已变化，请重新检查元素')
    return { inspection: target, frameId: args.frameId, tabId: args.tabId }
  }
  async pick(args) {
    const s = this.session
    s.validateFrame(args)
    if (this.items.size >= MAX_ITEMS) throw new Error('最多保留 8 个标注，请先移除不需要的标注')
    const page = s.page(), viewport = page.viewportSize(), generation = s.annotationGeneration, epoch = s.epoch
    let box = selectionBox(args, viewport), target = null
    if (args.kind === 'element') {
      target = await inspectElement(page, box)
      if (!target) throw new Error('这个位置没有可标注的元素，请重新选择')
      if (args.targetId && args.targetId !== target.targetId) throw new Error('检查的元素已变化，请重新悬停后选择')
      box = selectionBox(target, viewport)
    } else if (args.kind !== 'region') throw new Error('Invalid annotation kind')
    const fingerprint = await observation(page)
    const image = await page.screenshot({ type: 'png', clip: box, scale: 'css', timeout: 10000 })
    const after = await observation(page)
    const targetAfter = target ? await inspectElement(page, { x: args.box.x, y: args.box.y }) : null
    s.check(); s.validateFrame(args)
    if (s.page() !== page || epoch !== s.epoch || generation !== s.annotationGeneration || fingerprint !== after || target && target.targetId !== targetAfter?.targetId) throw new Error('页面已变化，请重新选择标注位置')
    const encoded = imageSize(image)
    if (encoded.width !== box.width || encoded.height !== box.height) throw new Error('Annotation screenshot size mismatch')
    const bytes = [...this.items.values()].reduce((total, item) => total + item.image.length, 0)
    if (image.length > 2 * 1024 * 1024 || bytes + image.length > MAX_BYTES) throw new Error('标注截图过大，请缩小选区或移除旧标注')
    const id = randomUUID()
    this.items.set(id, { id, kind: args.kind, box, target: target ? { tag: target.tag, role: target.role, name: target.name, selector: target.selector } : null, viewport, url: page.url().slice(0, 1024), capturedAt: new Date().toISOString(), note: '', submitted: false, generation, fingerprint, page, image })
    return id
  }
  async submit(entries) {
    if (!Array.isArray(entries) || !entries.length || entries.length > MAX_ITEMS) throw new Error('Select annotations to submit')
    const s = this.session, page = s.page(), generation = s.annotationGeneration
    const fingerprint = page ? await observation(page) : null
    s.check()
    const selected = new Set()
    for (const entry of entries) {
      const item = this.items.get(entry?.id)
      if (selected.has(entry?.id) || !item || item.page !== page || item.generation !== generation || item.fingerprint !== fingerprint || generation !== s.annotationGeneration || page !== s.page()) throw new Error('标注已过期或不属于当前页面，请重新选择')
      if (typeof entry.note !== 'string' || !entry.note.trim() || entry.note.length > 600) throw new Error('每条标注需要 1–600 字的说明')
      selected.add(entry.id)
    }
    for (const entry of entries) Object.assign(this.items.get(entry.id), { note: entry.note.trim(), submitted: true })
  }
  remove(id) {
    if (!this.items.delete(id)) throw new Error('Annotation not found in this session')
  }
  image(id) {
    const item = this.items.get(id)
    if (!item?.submitted) throw new Error('Annotation is not submitted in this session')
    return item.image
  }
}
