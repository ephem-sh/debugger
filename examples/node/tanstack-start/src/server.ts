import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { withDebugger } from '@ephem-sh/debugger/vite/tanstack-start'

export default withDebugger(createServerEntry, handler)
