/**
 * Rewrite the stock model identity as model context during prompt assembly.
 * The assembled prompt is then rendered and durably logged by the harness.
 */

export const name = '@local/dsh-antigravity-compat'
export const inject = ['systemPrompt']

// Released desktop uses a prefix/suffix pair; older source uses one persona.
const PERSONA_SECTIONS = new Set(['deployment:persona-prefix', 'deployment:persona'])

/** Validate the explicit provider allowlist; omission never means all routes. */
export function providerAllowlist(config) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError(`${name}: config must contain a providers array`)
  }
  const unknown = Object.keys(config).find(key => key !== 'providers')
  if (unknown !== undefined) throw new TypeError(`${name}: unknown config key ${unknown}`)
  if (!Array.isArray(config.providers) || config.providers.length === 0
    || config.providers.some(provider => typeof provider !== 'string'
      || provider.trim() === '' || provider !== provider.trim())) {
    throw new TypeError(`${name}: providers must be a non-empty array of provider IDs`)
  }
  return new Set(config.providers)
}

/** Preserve custom prose; only the stock opening at the start is eligible. */
export function compatiblePersona(text, model) {
  const operands = ['{{model}}']
  if (typeof model === 'string' && model !== '') operands.push(model)
  for (const operand of operands) {
    const opening = `You are a coding agent powered by the ${operand} model.`
    if (!text.startsWith(opening)) continue
    const suffix = text.slice(opening.length)
    if (suffix !== '' && !/^\s/.test(suffix)) continue
    const newline = text.includes('\r\n') ? '\r\n' : '\n'
    return `You are a coding agent.${newline}Current model: ${operand}.` + suffix
  }
  return text
}

/** Return a new assembly only when this provider's stock persona changes. */
export function compatibleAssembly(assembly, providers) {
  if (!providers.has(assembly.variables.provider)) return assembly
  let changed = false
  const sections = assembly.sections.map(section => {
    if (!PERSONA_SECTIONS.has(section.name)) return section
    const text = compatiblePersona(section.text, assembly.variables.model)
    if (text === section.text) return section
    changed = true
    return { ...section, text }
  })
  return changed ? { ...assembly, sections } : assembly
}

/** Apply after downstream listeners have captured the current model route. */
export function apply(ctx, config) {
  const providers = providerAllowlist(config)
  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const resolved = await next()
    return compatibleAssembly(resolved, providers)
  }, { global: true, prepend: true })
}
