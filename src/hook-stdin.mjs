/**
 * Read a hook payload without allowing an open stdin pipe to freeze the host.
 * Timeout and stream errors resolve with the data received so far.
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
