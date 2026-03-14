#!/usr/bin/env bun
/**
 * Thin runner for example apps.
 *
 * Usage:
 *   bun run scripts/example.ts dev nextjs
 *   bun run scripts/example.ts install nextjs
 *   bun run scripts/example.ts list
 */
import { examples } from '../examples.config.js'
import { $ } from 'bun'
import path from 'node:path'

const [action, name] = process.argv.slice(2)

if (action === 'list' || !action) {
  console.log('Available examples:\n')
  for (const [key, cfg] of Object.entries(examples)) {
    const exists = await Bun.file(path.join(cfg.path, 'package.json')).exists()
    const status = exists ? '✓' : '·'
    console.log(`  ${status} ${key.padEnd(15)} ${cfg.path}`)
  }
  process.exit(0)
}

if (!name) {
  console.error(`Usage: bun run scripts/example.ts <dev|install|list> <name>`)
  process.exit(1)
}

const example = examples[name]
if (!example) {
  console.error(`Unknown example: "${name}". Run with "list" to see available examples.`)
  process.exit(1)
}

const exists = await Bun.file(path.join(example.path, 'package.json')).exists()
if (!exists && action !== 'install') {
  console.error(`Example "${name}" not scaffolded yet. Create it first at ${example.path}/`)
  process.exit(1)
}

switch (action) {
  case 'install':
    await $`cd ${example.path} && ${example.install.split(' ')}`.nothrow()
    break
  case 'dev':
    await $`cd ${example.path} && npx ${example.dev.split(' ')}`.nothrow()
    break
  default:
    console.error(`Unknown action: "${action}". Use "dev", "install", or "list".`)
    process.exit(1)
}
