import { Button, Toggle, Disclosure } from './controls.jsx'
import { useState } from 'react'
const labels = { 'user-control': '你正在接管', busy: '有操作排队', recording: '正在录像', 'download-armed': '下载授权有效', transfer: '正在传输', viewer: '正在查看' }
const states = { dormant: '未启动', starting: '启动中', active: '运行中', hibernated: '已回收', ended: '已结束' }

export function BrowserResources({ state, busy, act }) {
  const [open, setOpen] = useState(true)
  const resources = state.resources
  if (!resources?.host) return null
  const { host, memory } = resources
  const memoryText = memory?.status === 'measured' ? `${memory.privateWorkingSetMiB} MiB 私有驻留` : memory?.status === 'not-running' ? '未运行' : '未测量'
  return <Disclosure className="pw-browser-resources" title="资源管理" count={`${states[resources.state] ?? '未知'} · ${memoryText}`} open={open} onToggle={() => setOpen(previous => !previous)}>
    <dl className="pw-facts">
      <div><dt>当前浏览器</dt><dd>{states[resources.state] ?? '未知'} · {state.tabs.length}/{resources.maxTabs} 个标签</dd></div>
      <div><dt>当前采样</dt><dd>{memoryText}{memory?.status === 'measured' && <small> · {new Date(memory.measuredAtMs).toLocaleTimeString()}，非实时</small>}{memory?.status === 'unsupported' && <small> · {memory.reason}</small>}</dd></div>
      <div><dt>实例并发</dt><dd>{host.running}/{host.maxInstances} 个浏览器</dd></div>
      <div><dt>软内存目标</dt><dd>{host.memoryTargetMiB} MiB · {host.measured}/{host.running} 个有近期采样{host.measured > 0 ? ` · 已测合计 ${host.privateWorkingSetMiB} MiB` : ''}</dd></div>
      <div><dt>自动回收</dt><dd>{resources.autoReclaim ? `空闲 ${Math.round(resources.idleTimeoutMs / 60000 * 10) / 10} 分钟后` : '关闭'}{resources.protection?.length > 0 && <small> · 保护中：{resources.protection.filter(key => key !== 'busy').map(key => labels[key]).join('、') || '操作中'}</small>}</dd></div>
    </dl>
    {host.pressure === 'high' && <p role="status">近期采样已超过软目标，请回收闲置浏览器；受保护页面不会被强制关闭。</p>}
    <div className="pw-browser-inspect-actions">
      <Button type="button" disabled={busy || resources.state !== 'active'} onClick={() => act('measureResources')}>采样内存</Button>
      <Button type="button" disabled={busy || resources.state !== 'active' || state.recording} onClick={() => act('hibernate')}>回收当前浏览器</Button>
      {state.recoverableTabs > 0 && <Button type="button" disabled={busy} onClick={() => act('recoverTabs')}>恢复 {state.recoverableTabs} 个标签</Button>}
    </div>
    <Toggle label="允许本会话空闲或容量不足时自动回收" checked={resources.autoReclaim} disabled={busy} onChange={value => act('resourceMode', { autoReclaim: value })}/>
    <p className="pw-muted">回收保留网址，未提交表单不保存。接管、查看、录像和传输期间不自动回收。内存目标不是系统硬上限；未采样部分按未知处理。</p>
  </Disclosure>
}
