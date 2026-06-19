// Audience-aware machine translation for the Lingui catalogs.
//
// Reads the English source catalog (src/locales/en/messages.po) and, for every other locale,
// fills in entries whose `msgstr` is still empty by calling an OpenAI-compatible model. The model
// is told who the audience is (AI engineers) and which technical terms must stay English (see
// glossary.json). It is idempotent: already-translated entries are left untouched, so re-running
// after `npm run i18n:extract` only translates the strings that were newly added.
//
//   npm run i18n:translate          # fill missing translations for all non-source locales
//   npm run i18n:check              # exit 1 if any locale still has untranslated strings (no LLM)
//
// Configuration (env), only needed for the translate path, never for --check:
//   I18N_TRANSLATE_API_KEY   API key for the OpenAI-compatible endpoint (required)
//   I18N_TRANSLATE_BASE_URL  Base URL of the endpoint (optional; defaults to OpenAI)
//   I18N_TRANSLATE_MODEL     Model id (optional; defaults to gpt-4o-mini)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatter as poFormatter } from '@lingui/format-po'

const here = dirname(fileURLToPath(import.meta.url))
const frontendRoot = join(here, '..', '..')
const localesRoot = join(frontendRoot, 'src', 'locales')
const SOURCE_LOCALE = 'en'
const BATCH_SIZE = 40

// Mirror lingui.config.ts so the tool writes byte-identical files to `lingui extract`.
const format = poFormatter({ origins: false })

/** English names of the locales we target, for the translation prompt. */
const LOCALE_DISPLAY_NAMES = {
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  ja: 'Japanese',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
}

function loadGlossary() {
  return JSON.parse(readFileSync(join(here, 'glossary.json'), 'utf8'))
}

/** Every locale directory under src/locales except the English source. */
function targetLocales() {
  return readdirSync(localesRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== SOURCE_LOCALE)
    .map(d => d.name)
}

function catalogPath(locale) {
  return join(localesRoot, locale, 'messages.po')
}

async function readCatalog(locale) {
  const content = readFileSync(catalogPath(locale), 'utf8')
  const catalog = await format.parse(content, {
    locale,
    sourceLocale: SOURCE_LOCALE,
    filename: catalogPath(locale),
  })
  return { content, catalog }
}

/** The English source text for an entry (the message, falling back to the id which is the source). */
function sourceText(entry, id) {
  return entry.message || id
}

/** Ids in `catalog` that still need a translation. */
function missingIds(catalog) {
  return Object.keys(catalog).filter(id => !catalog[id].translation)
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function systemPrompt(targetName, glossary) {
  return [
    `You are a professional software localizer. You translate UI strings from English into ${targetName}.`,
    `Context — the product and its audience: ${glossary.audience}`,
    `Rules:`,
    `1. Keep these technical terms in English, verbatim and uninflected (do not translate them): ${glossary.doNotTranslate.join(', ')}.`,
    `2. Preserve every placeholder and markup token exactly: ICU tokens like {count}, {name}; Lingui tags like <0>...</0>; and any markdown.`,
    `3. These are short UI labels, buttons, headings and messages — keep them concise and natural for software UI.`,
    `4. Preserve leading/trailing whitespace, surrounding punctuation, and capitalization style.`,
    `5. Translate the meaning, not word-for-word. Return one translation per input string, in the same order.`,
  ].join('\n')
}

async function translateBatch(model, system, sources) {
  const { generateObject, jsonSchema } = await import('ai')
  const { object } = await generateObject({
    model,
    schema: jsonSchema({
      type: 'object',
      additionalProperties: false,
      required: ['translations'],
      properties: {
        translations: {
          type: 'array',
          items: { type: 'string' },
          description: 'The translated strings, one per input, in the same order.',
        },
      },
    }),
    system,
    prompt:
      `Translate these ${sources.length} strings. Respond with a "translations" array of exactly ${sources.length} items, in order:\n\n` +
      JSON.stringify(sources, null, 2),
  })
  const out = object?.translations
  if (!Array.isArray(out) || out.length !== sources.length) {
    throw new Error(`Model returned ${out?.length ?? 0} translations for ${sources.length} inputs`)
  }
  return out
}

function makeModel() {
  const apiKey = process.env.I18N_TRANSLATE_API_KEY
  if (!apiKey) {
    console.error(
      'i18n:translate needs an API key. Set I18N_TRANSLATE_API_KEY (and optionally\n' +
        'I18N_TRANSLATE_BASE_URL / I18N_TRANSLATE_MODEL). Any OpenAI-compatible endpoint works,\n' +
        "including Proxytrace's own proxy.",
    )
    process.exit(1)
  }
  return { apiKey, baseURL: process.env.I18N_TRANSLATE_BASE_URL, modelId: process.env.I18N_TRANSLATE_MODEL || 'gpt-4o-mini' }
}

async function runCheck() {
  const locales = targetLocales()
  let total = 0
  for (const locale of locales) {
    const { catalog } = await readCatalog(locale)
    const missing = missingIds(catalog)
    if (missing.length) {
      total += missing.length
      console.error(`✗ ${locale}: ${missing.length} untranslated string(s)`)
      for (const id of missing.slice(0, 10)) console.error(`    - ${sourceText(catalog[id], id)}`)
      if (missing.length > 10) console.error(`    … and ${missing.length - 10} more`)
    } else {
      console.log(`✓ ${locale}: fully translated`)
    }
  }
  if (total > 0) {
    console.error(`\n${total} untranslated string(s). Run \`npm run i18n:translate\`.`)
    process.exit(1)
  }
  console.log('All catalogs fully translated.')
}

async function runTranslate() {
  const glossary = loadGlossary()
  const { apiKey, baseURL, modelId } = makeModel()
  const { createOpenAI } = await import('@ai-sdk/openai')
  const openai = createOpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
  const model = openai(modelId)

  const { catalog: sourceCatalog } = await readCatalog(SOURCE_LOCALE)
  const locales = targetLocales()
  if (!locales.length) {
    console.log('No target locales to translate.')
    return
  }

  for (const locale of locales) {
    const { content, catalog } = await readCatalog(locale)
    const missing = missingIds(catalog)
    if (!missing.length) {
      console.log(`✓ ${locale}: already complete`)
      continue
    }
    const targetName = LOCALE_DISPLAY_NAMES[locale] || locale
    const system = systemPrompt(targetName, glossary)
    console.log(`→ ${locale}: translating ${missing.length} string(s) via ${modelId}…`)

    for (const ids of chunk(missing, BATCH_SIZE)) {
      const sources = ids.map(id => sourceText(sourceCatalog[id] ?? catalog[id], id))
      const translations = await translateBatch(model, system, sources)
      ids.forEach((id, i) => {
        catalog[id].translation = translations[i]
      })
    }

    const serialized = await format.serialize(catalog, {
      locale,
      sourceLocale: SOURCE_LOCALE,
      filename: catalogPath(locale),
      existing: content,
    })
    writeFileSync(catalogPath(locale), serialized)
    console.log(`✓ ${locale}: wrote ${missing.length} translation(s)`)
  }
}

const isCheck = process.argv.includes('--check')
await (isCheck ? runCheck() : runTranslate())
