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
  const [settings, setSettings] = useState(null)
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
    let reading = false
    const delay = () => (typeof document !== 'undefined' && document.hidden ? 10000 : 2000)
    async function read() {
      if (reading) return
      reading = true
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
      } finally {
        reading = false
        if (!stopped) timer = setTimeout(read, delay())
      }
    }
    // A hidden panel polls slowly; becoming visible refreshes immediately.
    const onVisible = () => {
      if (typeof document === 'undefined' || document.hidden || stopped) return
      clearTimeout(timer)
      void read()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    void read()
    return () => {
      stopped = true
      controller.abort()
      clearTimeout(timer)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
    }
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
  async function improvementAction(action, candidateId, expectedRevision, fields = {}) {
    return mutate('improvementPath', { action, candidateId, incidentId: action === 'propose' ? candidateId : undefined, expectedRevision, ...fields })
  }
  const superagentAction = body => mutate('superagentPath', body)
  const evidenceAction = body => mutate('evidencePath', body)
  // Update check is global and explicit. It does not need a Patchwork session,
  // but it still requires the page credential injected with the bridge metadata.
  async function checkUpdate() {
    const metadata = readConnectionMetadata()
    if (!metadata?.updatePath || !metadata.token) throw new Error('update-unavailable')
    const response = await fetch(metadata.updatePath, { method: 'POST', headers: { 'x-patchwork-token': metadata.token }, cache: 'no-store' })
    const data = await response.json()
    if (!response.ok || data.ok === false) throw new Error(data.reason ?? 'update-check-failed')
    return data
  }
  // Sessionless read-only settings. It never returns task/evidence/memory state,
  // so a standard or absent Agent can still inspect configuration before saving.
  const loadSettings = useCallback(async () => {
    const metadata = readConnectionMetadata()
    if (!active.current || !metadata?.settingsPath || !metadata.token) { setSettings(null); return null }
    try {
      const response = await fetch(metadata.settingsPath, { headers: { 'x-patchwork-token': metadata.token }, cache: 'no-store' })
      const data = await response.json()
      if (!active.current) return null
      if (!response.ok || !data.ok) throw new Error(data.reason ?? 'settings-unavailable')
      setSettings(data)
      return data
    } catch { if (active.current) setSettings(null); return null }
  }, [])
  return { snapshot, settings, connection, error, save, exportLogs, memoryAction, memoryQuery, improvementAction, superagentAction, evidenceAction, loadSettings, checkUpdate, refresh: () => refresh(x => x+1) }
}
