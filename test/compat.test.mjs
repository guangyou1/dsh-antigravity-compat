import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, compatibleAssembly, compatiblePersona, providerAllowlist } from '../index.js'

const stock = 'You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.'
const providers = new Set(['hahagemini', 'antigravity'])

function assembly(provider = 'hahagemini', persona = stock) {
  return {
    sections: [
      { name: 'harness:identity', text: 'You are an AI agent powered by DeepSeek Harness.' },
      { name: 'deployment:persona', text: persona },
      { name: 'tool:rules', text: 'Keep tool instructions and paths unchanged.' },
    ],
    contexts: [{ name: 'workspace', text: 'Existing context.' }],
    tools: [{ name: 'read', parameters: { type: 'object' } }],
    variables: { provider, model: 'gemini-3.8-flash-high', cwd: 'E:/work' },
  }
}

test('preserves model and working directory while converting the stock persona', () => {
  const original = assembly()
  Object.freeze(original.sections[1])
  Object.freeze(original.sections)
  const result = compatibleAssembly(original, providers)
  assert.equal(result.sections[1].text, 'You are a coding agent.\nCurrent model: {{model}}. Your working directory is {{cwd}}.')
  assert.equal(original.sections[1].text, stock)
  assert.equal(result.sections[0], original.sections[0])
  assert.equal(result.sections[2], original.sections[2])
  assert.equal(result.contexts, original.contexts)
  assert.equal(result.tools, original.tools)
  assert.equal(result.variables, original.variables)
})

test('DeepSeek and unselected providers remain byte-for-byte unchanged', () => {
  for (const provider of ['deepseek-account', 'deepseek', 'google', 'xiaoai', undefined]) {
    const original = assembly(provider)
    if (provider === undefined) delete original.variables.provider
    assert.equal(compatibleAssembly(original, providers), original)
  }
})

test('released desktop persona-prefix is eligible while persona-suffix stays intact', () => {
  const original = assembly()
  original.sections[1].name = 'deployment:persona-prefix'
  const suffix = { name: 'deployment:persona-suffix', text: stock }
  original.sections.push(suffix)
  const result = compatibleAssembly(original, providers)
  assert.match(result.sections[1].text, /^You are a coding agent\.\nCurrent model:/)
  assert.equal(result.sections.at(-1), suffix)
})

test('all allowlisted relay models receive the same limited conversion', () => {
  for (const provider of providers) {
    for (const model of ['gemini-3.8-flash-high', 'claude-sonnet-4-6']) {
      const original = assembly(provider)
      original.variables.model = model
      const result = compatibleAssembly(original, providers)
      assert.match(result.sections[1].text, /^You are a coding agent\.\nCurrent model:/)
      assert.equal(result.variables.model, model)
    }
  }
})

test('custom personas, quoted examples, and other sections are preserved', () => {
  for (const text of ['Custom coding instructions.', `Example:\n${stock}`, `\`\`\`text\n${stock}\n\`\`\``, stock.replace('model.', 'model.explanation')]) {
    const original = assembly('hahagemini', text)
    assert.equal(compatibleAssembly(original, providers), original)
  }
  const original = assembly('hahagemini', 'Custom persona.')
  original.sections.push({ name: 'other', text: stock })
  assert.equal(compatibleAssembly(original, providers), original)
})

test('supports already resolved dotted model IDs and Windows line endings', () => {
  const text = 'You are a coding agent powered by the claude-sonnet-4-6 model.\r\nKeep this rule.'
  assert.equal(compatiblePersona(text, 'claude-sonnet-4-6'), 'You are a coding agent.\r\nCurrent model: claude-sonnet-4-6.\r\nKeep this rule.')
  assert.equal(compatiblePersona(text, 'another-model'), text)
})

test('repeated assembly is stable and cannot accumulate replacements', () => {
  const first = compatibleAssembly(assembly(), providers)
  assert.equal(compatibleAssembly(first, providers), first)
})

test('the hook uses the resolved provider after downstream model selection', async () => {
  let listener
  const ctx = { on(event, callback, options) {
    assert.equal(event, 'system-prompt/assemble')
    assert.deepEqual(options, { global: true, prepend: true })
    listener = callback
  } }
  apply(ctx, { providers: [...providers] })
  const stale = assembly('deepseek-account')
  const selected = assembly('hahagemini')
  assert.notEqual(await listener(stale, {}, async () => selected), selected)
  assert.equal(await listener(selected, {}, async () => stale), stale)
})

test('invalid or missing allowlists fail at plugin load', () => {
  for (const config of [undefined, null, {}, { providers: [] }, { providers: [''] }, { providers: [' bad '] }, { providers: [42] }, { providers: ['hahagemini'], all: true }]) {
    assert.throws(() => providerAllowlist(config), TypeError)
  }
})
