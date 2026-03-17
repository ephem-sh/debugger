import { initDebugger, DebuggerMiddleware as BaseMiddleware } from '@ephem-sh/debugger/adonis'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

initDebugger({ port: 3333 })

const base = new BaseMiddleware()

export default class DebuggerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    return base.handle(ctx, next)
  }
}
