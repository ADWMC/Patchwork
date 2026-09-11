/**
 * 读取 Hook 载荷，同时不允许一个未关闭的 stdin 挂住宿主。
 * 超时与流错误都以「已收到的内容」结束。
 */
export function readHookStdin({ stream = process.stdin, timeoutMs = 1000 } = {}) {
  return new Promise(resolve => {
    let input = ''
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stream.pause?.()
      stream.removeListener?.('data', onData)
      stream.removeListener?.('end', finish)
      stream.removeListener?.('error', finish)
      resolve(input)
    }
    const onData = chunk => { input += chunk }
    const timer = setTimeout(finish, timeoutMs)
    timer.unref?.()

    stream.setEncoding?.('utf8')
    stream.on('data', onData)
    stream.once('end', finish)
    stream.once('error', finish)
  })
}

export async function runJsonHook(handler, options = {}) {
  if (typeof handler !== 'function') throw new TypeError('handler must be a function')
  const input = await readHookStdin(options)
  let payload = {}
  if (input.trim() !== '') {
    try {
      payload = JSON.parse(input.replace(/^\uFEFF/, ''))
    } catch {
      payload = { raw: input }
    }
  }
  const output = await handler(payload)
  process.stdout.write(JSON.stringify(output ?? {}))
}
