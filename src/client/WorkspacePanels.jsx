import { SegmentedTabs } from '@deepseek-ai/dsh-client-ui-primitives'
import { ImprovementPanel } from './ImprovementPanel.jsx'
import { MemoryPanel } from './MemoryPanel.jsx'
import { ToolEvidencePanel } from './ToolEvidencePanel.jsx'
import { SETTING_FIELDS } from '../config/fields.mjs'
import { TaskEvidence } from './TaskEvidence.jsx'
import { RetrievalPanel } from './RetrievalPanel.jsx'

export { OverviewPanel, MechanismsPanel, MechanismStatus, mechanisms } from "./OperationalPanels.jsx"
export const settingsKeys = SETTING_FIELDS.map(field => field.key)

export function EvidencePanel({ data, view, setView, prefix, memoryAction, memoryQuery, improvementAction, superagentAction }) {
  const events = data.events ?? []
  return <><nav className="pw-secondary-nav"><SegmentedTabs label="证据类别" value={view} onChange={setView} items={[
    ['current', '本次'], ['retrieval', '检索'], ['memory', '记忆'], ['improvements', '改进'],
  ].map(([value, label]) => ({ value, label, id: prefix + '-evidence-' + value, panelId: prefix + '-evidence-panel' }))}/></nav>
    <div role="tabpanel" id={prefix + '-evidence-panel'} aria-labelledby={prefix + '-evidence-' + view}>
      {view === 'current' && <><TaskEvidence task={data.task} expanded reviewAction={superagentAction}/><ToolEvidencePanel events={events}/></>}
      {view === 'retrieval' && <RetrievalPanel data={data}/>}
      {view === 'memory' && <MemoryPanel data={data} onCurrent={() => setView('current')} memoryAction={memoryAction} memoryQuery={memoryQuery}/>}
      {view === 'improvements' && <ImprovementPanel data={data} improvementAction={improvementAction}/>}
    </div>
  </>
}


export { SettingsPanel } from "./SettingsPanel.jsx"
