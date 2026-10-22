import { createContext, useContext, useState } from 'react'

const InteractionContext = createContext(null)
export const interactionTypes = new Set(['clarification', 'budget', 'preferences', 'quick_replies', 'calendar', 'visit', 'confirmation', 'contact'])
export const useInteraction = () => useContext(InteractionContext)

export function InteractionCoordinator({ groups, answeredIds, busy = false, children }) {
  const [selection, setSelection] = useState(null)
  const available = groups.flat().filter(widget => interactionTypes.has(widget.type) && !answeredIds.includes(widget.id) && !(widget.type === 'contact' && widget.props?.draft))
  const newest = [...groups].reverse().find(group => group.some(widget => available.some(row => row.id === widget.id))) || []
  const latest = newest.find(widget => widget.type === 'clarification' && available.some(row => row.id === widget.id)) || newest.find(widget => ['budget', 'preferences'].includes(widget.type) && available.some(row => row.id === widget.id)) || [...newest].reverse().find(widget => available.some(row => row.id === widget.id))
  const activeId = selection?.latest === latest?.id && available.some(widget => widget.id === selection.id) ? selection.id : latest?.id
  return <InteractionContext.Provider value={{ activeId: busy ? null : activeId, busy, activate: id => setSelection({ id, latest: latest?.id }) }}>{children}</InteractionContext.Provider>
}
