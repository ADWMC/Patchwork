import { useCallback, useEffect, useRef, useState } from 'react'

export function readConnectionMetadata() {
  const rows = [...document.querySelectorAll('script[data-patchwork-stats]')]
  for (const node of rows.reverse()) {
    try { const data = JSON.parse(node.textContent); if (data.statePath && data.token) return data } catch { /* Try the previous owner. */ }
  }
  return null
}

export function usePatchworkState(sessionId) {
  const [snapshot, setSnapshot] = useState(null)
  const [connection, setConnection] = useState('loading')
  const [error, setError] = useState('')
  const [refreshKey, refresh] = useState(0)
  const version = useRef(0)
  const active = useRef(false)
  const exportController = useRef(null)
  const saveController = useRef(null)
  const mutations = useRef(new Set())
  useEffect(() => {
    active.current = true
    return () => { active.current = false; exportController.current?.abort(); saveController.current?.abort(); for (const controller of mutations.current) controller.abort(); mutations.current.clear() }
  }, [sessionId])
  useEffect(() => {
    const metadata = readConnectionMetadata()
    let stopped = false
    let timer
    const controller = new AbortController()
    setError('')
    if (!sessionId || !metadata) {
      setConnection('unavailable')
      return () => { controller.abort() }
    }
    setConnection('loading')
    async function read() {
      const current = version.current
      try {
        const response = await fetch(metadata.statePath+'?sessionId='+encodeURIComponent(sessionId), {
          headers: { 'x-patchwork-token': metadata.token }, signal: controller.signal, cache: 'no-store',
        })
        if (response.status === 403) {
          if (!stopped) { setSnapshot(null); setConnection('unavailable'); setError('请先切换到 Patchwork Agent') }
          return
        }
        if (!response.ok) throw new Error('读取失败（HTTP '+response.status+'）')
        const data = await response.json()
        if (!data.ok || data.sessionId !== sessionId) throw new Error('会话状态响应不匹配')
        if (!stopped && current === version.current) { setSnapshot(data); setConnection('connected'); setError('') }
      } catch (e) {
        if (!stopped) { setConnection('offline'); setError(e.message) }
      } finally { if (!stopped) timer = setTimeout(read, 2000) }
    }
    void read()
    return () => { stopped = true; controller.abort(); clearTimeout(timer) }
  }, [sessionId, refreshKey])

  async function save(patch, revision) {
    const metadata = readConnectionMetadata()
    if (!active.current || !metadata || !sessionId || connection !== 'connected') throw new Error('请先切换到 Patchwork Agent 并连接状态通道')
    saveController.current?.abort()
    const controller = new AbortController()
    saveController.current = controller
    version.current++
    const response = await fetch(metadata.writePath+'?sessionId='+encodeURIComponent(sessionId), {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-patchwork-token': metadata.token, 'x-patchwork-revision': revision },
      body: JSON.stringify(patch),
      signal: controller.signal,
    })
    const payload = await response.json()
    if (!active.current || controller.signal.aborted) throw new Error('会话已切换，保存结果不再应用于此面板')
    if (!response.ok) {
      if (response.status === 403) { setSnapshot(null); setConnection('unavailable') }
      const e = new Error(payload.reason ?? '保存失败')
      e.conflict = response.status === 409 ? payload : null
      throw e
    }
    setSnapshot(previous => previous && ({ ...previous, config: payload.config, revision: payload.revision }))
    return payload
  }
  async function exportLogs() {
    const metadata = readConnectionMetadata()
    if (!active.current || !metadata?.logsPath || connection !== 'connected') throw new Error('logs-unavailable')
    exportController.current?.abort()
    const controller = new AbortController()
    exportController.current = controller
    const response = await fetch(metadata.logsPath+'?sessionId='+encodeURIComponent(sessionId), {
      headers: { 'x-patchwork-token': metadata.token }, signal: controller.signal, cache: 'no-store',
    })
    const data = await response.json()
    if (!active.current || controller.signal.aborted || !response.ok || !data.ok) throw new Error('logs-forbidden-or-unavailable')
    return data
  }
  const memoryQuery = useCallback(async (params = {}, signal) => {
    const metadata = readConnectionMetadata()
    if (!active.current || !metadata?.memoryPath || !sessionId) throw new Error('memory-unavailable')
    const controller = new AbortController(); mutations.current.add(controller)
    try {
      const query = new URLSearchParams({ sessionId, ...params })
      const response = await fetch(metadata.memoryPath + '?' + query, { headers: { 'x-patchwork-token': metadata.token }, signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal, cache: 'no-store' })
      const value = await response.json()
      if (!active.current || controller.signal.aborted) throw new Error('session-changed')
      if (!response.ok || !value.ok) throw new Error(value.failureCode ?? value.reason ?? 'memory-unavailable')
      return value
    } finally { mutations.current.delete(controller) }
  }, [sessionId])
  async function memoryAction(action, id, expectedRevision, fields = {}) {
    return mutate('memoryPath', { action, id, expectedRevision, ...fields })
  }
  async function mutate(path, body) {
    const metadata = readConnectionMetadata()
    if (!active.current || !metadata?.[path] || !sessionId || connection !== 'connected') throw new Error('management-unavailable')
    const controller = new AbortController(); mutations.current.add(controller)
    try {
    const response = await fetch(metadata[path]+'?sessionId='+encodeURIComponent(sessionId), {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-patchwork-token': metadata.token },
      body: JSON.stringify(body), signal: controller.signal,
    })
    const data = await response.json()
    if (!active.current || controller.signal.aborted) throw new Error('session-changed')
    if (!response.ok || !data.ok) { const error = new Error(data.failureCode ?? data.reason ?? 'management-action-failed'); error.conflict = response.status === 409 ? data : null; throw error }
    refresh(x => x + 1)
    return data
    } finally { mutations.current.delete(controller) }
  }
  async function improvementAction(action, candidateId, expectedRevision) {
    return mutate('improvementPath', { action, candidateId, incidentId: action === 'propose' ? candidateId : undefined, expectedRevision })
  }
  const superagentAction = body => mutate('superagentPath', body)
  return { snapshot, connection, error, save, exportLogs, memoryAction, memoryQuery, improvementAction, superagentAction, refresh: () => refresh(x => x+1) }
}
