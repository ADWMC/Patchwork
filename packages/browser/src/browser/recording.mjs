import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, stat, open } from 'node:fs/promises'
import { join, toNamespacedPath } from 'node:path'
import { randomUUID } from 'node:crypto'
import { browserProfilesRoot } from './profiles.mjs'
import { fileHash } from './backends.mjs'
import { browserEnvironment } from './policy.mjs'
import { capture } from './evidence.mjs'
import { readComponent, leaseComponent } from './components/store.mjs'

export async function recorderAvailability(root = browserProfilesRoot()) {
  try {
    const component = await readComponent(root, 'recorder')
    if (component) return { installed: component.installed, mode: 'selected-tab-sampling', framesPerSecond: 4, ...(!component.installed ? { reason: 'Run npm run components -- install recorder --home ABS_DSH_HOME' } : {}) }
    const manifest = JSON.parse(await readFile(join(root, 'backends/recorder/manifest.json'), 'utf8'))
    if (manifest.version !== 1 || manifest.driverVersion !== '1.64.1' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error('Invalid recorder manifest')
    if (!(await stat(manifest.executable)).isFile()) throw new Error('Missing recorder executable')
    return { installed: true, mode: 'selected-tab-sampling', framesPerSecond: 4 }
  } catch { return { installed: false, reason: 'Run npm run components -- install recorder --home ABS_DSH_HOME before recording' } }
}

export class BrowserRecorder {
  static async start(session) {
    if (!session.page()) throw new Error('请先打开浏览器页面再开启录像')
    const root = session.componentRoot ?? session.root ?? browserProfilesRoot(), release = await leaseComponent(root, 'recorder')
    let directory
    try {
      const component = await readComponent(root, 'recorder', { verify: true })
      if (component && !component.installed) throw new Error('录像组件已卸载，请使用 components install recorder 显式安装')
      let manifest = component ? { executable: component.executable } : null
      if (!component) {
        const manifestPath = join(root, 'backends/recorder/manifest.json')
        manifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => { throw new Error('请先在目标 DSH_HOME 运行 npm run components -- install recorder 安装独立录像依赖') }))
        if (manifest.version !== 1 || manifest.driverVersion !== '1.64.1' || !/^[a-f0-9]{64}$/.test(manifest.sha256) || await fileHash(manifest.executable) !== manifest.sha256) throw new Error('Recorder integrity check failed')
      }
      manifest.executable = toNamespacedPath(manifest.executable)
      directory = join(session.profiles.path, `recording-${randomUUID()}`)
      await mkdir(directory, { recursive: true, mode: 0o700 })
      const output = join(directory, 'selected-tab.webm')
      const viewport = session.page()?.viewportSize() ?? session.profile?.viewport ?? { width: 1280, height: 800 }
      const width = Math.ceil(viewport.width / 2) * 2; const height = Math.ceil(viewport.height / 2) * 2
      const child = spawn(manifest.executable, ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '4', '-vcodec', 'mjpeg', '-i', 'pipe:0', '-an', '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`, '-c:v', 'libvpx-vp9', '-quality', 'realtime', '-cpu-used', '8', '-b:v', '800k', '-y', toNamespacedPath(output)], { windowsHide: true, env: browserEnvironment(), stdio: ['pipe', 'ignore', 'pipe'] })
      child.stderr.resume()
      const recorder = new BrowserRecorder(session, directory, output, child, release)
      return recorder
    } catch (error) { try { if (directory) await rm(directory, { recursive: true, force: true }) } finally { await release() } throw error }
  }

  constructor(session, directory, output, child, release = async () => {}) {
    Object.assign(this, { session, directory, output, child, frames: 0, failures: 0, startedAt: Date.now(), stopped: false })
    this.exited = new Promise(resolve => { child.once('error', () => resolve(-1)); child.once('close', resolve) }).then(async code => { try { await release(); return code } catch { this.failed = true; return -1 } })
    child.once('error', () => { this.failed = true })
    child.once('close', () => { if (!this.stopped && !this.limitReached) this.failed = true })
    child.stdin.on('error', () => { this.failed = true })
    this.timer = setInterval(() => { if (!this.pending && !session.running && session.page() && !this.stopped) this.pending = this.tick().finally(() => { this.pending = null }) }, 250)
    this.timer.unref?.()
    this.limitTimer = setTimeout(() => {
      this.limitReached = true; clearInterval(this.timer)
      void Promise.resolve(this.pending).finally(() => this.child.stdin.end())
    }, 15 * 60_000)
    this.limitTimer.unref?.()
  }

  async tick() {
    try {
      if (this.failed) { clearInterval(this.timer); this.child.kill(); return }
      if (Date.now() - this.startedAt > 15 * 60_000) { this.limitReached = true; clearInterval(this.timer); this.child.stdin.end(); return }
      const frame = await capture(this.session)
      if (!frame || this.stopped || this.limitReached) return
      if (!this.child.stdin.write(frame.image)) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => { clean(); reject(new Error('Recorder backpressure timeout')) }, 3000)
          const done = () => { clean(); resolve() }; const error = () => { clean(); reject(new Error('Recorder input closed')) }
          const clean = () => { clearTimeout(timer); this.child.stdin.off('drain', done); this.child.stdin.off('error', error) }
          this.child.stdin.once('drain', done); this.child.stdin.once('error', error)
        })
      }
      this.frames++
    } catch { this.failures++; if (this.failures >= 10) { this.failed = true; clearInterval(this.timer); this.child.kill() } }
  }

  async stop({ discard = false } = {}) {
    if (this.stopping) return this.stopping
    this.stopping = (async () => {
      this.stopped = true; clearInterval(this.timer); clearTimeout(this.limitTimer)
      if (discard) this.child.kill()
      await this.pending
      this.child.stdin.end()
      const timeout = setTimeout(() => this.child.kill(), 10_000)
      let code
      try { code = await this.exited } finally { clearTimeout(timeout) }
      if (discard) { await rm(this.directory, { recursive: true, force: true }); return null }
      if (this.failed || code !== 0 || !this.frames || !(await stat(this.output).catch(() => null))?.size) throw new Error('录像未产生有效文件；未交付空文件或失败任务')
      const file = await open(this.output, 'r')
      try {
        const buffer = Buffer.alloc(512); const { bytesRead } = await file.read(buffer, 0, buffer.length, 0)
        if (!buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) || !buffer.subarray(0, bytesRead).includes(Buffer.from('webm'))) throw new Error('Recorder output is not a valid WebM container')
      } finally { await file.close() }
      return { path: this.output, frames: this.frames, dropped: this.failures }
    })()
    return this.stopping
  }
}
