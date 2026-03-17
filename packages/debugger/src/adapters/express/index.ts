/**
 * Express adapter — re-exports the Express instrumentation from the Angular adapter.
 *
 * @example
 * ```ts
 * import express from 'express'
 * import { instrumentExpress } from '@ephem-sh/debugger/express'
 *
 * const app = express()
 * instrumentExpress(app)
 * ```
 *
 * @module
 */
export { instrumentExpress } from '../angular/index.js'
