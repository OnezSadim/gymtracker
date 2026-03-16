import type { SetType } from '@/types/workout'

export interface ParsedSet {
  weight: string
  reps: string
  type: SetType
  restBefore?: number           // seconds of rest before this set
  dropEntries?: { weight: string; reps: string }[]  // for dropset/halfrep
}

export interface ParsedExercise {
  name: string
  sets: ParsedSet[]
}

// ── Patterns ──────────────────────────────────────────────────────────────────

const WEIGHT_REPS = /(\d+\.?\d*|bw)\s*(?:kg|lbs?|lb)?\s*[x×]\s*(\d+\.?\d*)/i
const MULTI_ENTRY = /(\d+\.?\d*)\s*(?:kg|lbs?)?\s*[x×]\s*(\d+\.?\d*)/gi
// Rest: "rest 2:30" | "rest 90s" | "rest 2min" | "90 seconds rest" | "2 min"
const REST_LINE =
  /(?:rest\s+|(\d+\.?\d*)\s*(?:min(?:utes?)?|secs?|seconds?)\s*(?:rest)?$)(?:(\d+):(\d+)|(\d+\.?\d*)\s*(m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)?)?/i

function parseRestSeconds(line: string): number | null {
  const l = line.trim().toLowerCase()
  // "rest N:SS"
  const colonMatch = /rest\s+(\d+):(\d+)/i.exec(line)
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2])
  // "rest N unit" or "N unit"
  const valMatch = /(?:rest\s+)?(\d+\.?\d*)\s*(min(?:utes?)?|sec(?:onds?)?|m|s)?\b/i.exec(line)
  if (valMatch && (l.includes('rest') || l.includes('min') || l.includes('sec'))) {
    const val = parseFloat(valMatch[1])
    const unit = (valMatch[2] || '').toLowerCase()
    if (unit.startsWith('m')) return Math.round(val * 60)
    if (unit.startsWith('s')) return Math.round(val)
    return val > 15 ? Math.round(val) : Math.round(val * 60)
  }
  return null
}

function getLineType(line: string): SetType | null {
  const l = line.toLowerCase()
  if (/warm[\s-]?up|\bwu\b/.test(l)) return 'warmup'
  if (/half[\s-]?rep|\bhr\b/.test(l)) return 'halfrep'
  if (/drop[\s-]?set|\bdrop\b/.test(l)) return 'dropset'
  if (/\bfail(?:ure)?|\bamrap\b/.test(l)) return 'failure'
  return null
}

function extractEntries(line: string): { weight: string; reps: string }[] {
  const entries: { weight: string; reps: string }[] = []
  let m: RegExpExecArray | null
  MULTI_ENTRY.lastIndex = 0
  while ((m = MULTI_ENTRY.exec(line)) !== null) {
    entries.push({ weight: m[1].toUpperCase(), reps: m[2] })
  }
  return entries
}

function isExerciseName(line: string): boolean {
  const t = line.trim()
  if (!t || t.length < 2) return false
  if (/^\d/.test(t)) return false
  if (WEIGHT_REPS.test(t)) return false
  if (!/[a-z]{2}/i.test(t)) return false
  return true
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseWorkoutText(raw: string): ParsedExercise[] {
  const lines = raw.split(/[\n;]/).map(l => l.trim()).filter(Boolean)
  const result: ParsedExercise[] = []
  let cur: ParsedExercise | null = null
  let pendingRest: number | undefined
  let pendingType: SetType = 'normal'

  for (const line of lines) {
    const lower = line.toLowerCase()

    // Rest line (no weight×reps on it)
    if (!WEIGHT_REPS.test(line)) {
      const rest = parseRestSeconds(line)
      if (rest !== null) { pendingRest = rest; continue }
    }

    // Standalone type modifiers
    if (/^(warm[\s-]?up|wu)[:\s]*$/i.test(line))       { pendingType = 'warmup';  continue }
    if (/^(drop[\s-]?set|drop)[:\s]*$/i.test(line))     { pendingType = 'dropset'; continue }
    if (/^(half[\s-]?reps?|hr)[:\s]*$/i.test(line))     { pendingType = 'halfrep'; continue }
    if (/^(fail(?:ure)?|amrap)[:\s]*$/i.test(line))     { pendingType = 'failure'; continue }

    // Multi-entry line with separator → / >
    const hasMultiSep = /[→>]|(?:\d\s*\/\s*\d)/.test(line)
    if (hasMultiSep) {
      const entries = extractEntries(line)
      if (entries.length >= 2 && cur) {
        const type = getLineType(line) ?? 'dropset'
        cur.sets.push({ weight: entries[0].weight, reps: entries[0].reps, type, restBefore: pendingRest, dropEntries: entries })
        pendingRest = undefined; pendingType = 'normal'
        continue
      }
    }

    // Single set line
    const entries = extractEntries(line)
    if (entries.length === 1 && cur) {
      const type: SetType = getLineType(line) ?? pendingType
      cur.sets.push({ weight: entries[0].weight, reps: entries[0].reps, type, restBefore: pendingRest })
      pendingRest = undefined; pendingType = 'normal'
      continue
    }

    // Multiple entries on one line without separator = multiple sets
    if (entries.length > 1 && cur) {
      const type: SetType = getLineType(line) ?? pendingType
      for (const e of entries) {
        cur.sets.push({ weight: e.weight, reps: e.reps, type, restBefore: pendingRest })
        pendingRest = undefined
      }
      pendingType = 'normal'
      continue
    }

    // Skip lines that look like dates with no sets
    if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(line) && !WEIGHT_REPS.test(line)) continue

    // Exercise name
    if (isExerciseName(line)) {
      const name = line.replace(/[:\-]+$/, '').trim()
      cur = { name, sets: [] }
      result.push(cur)
      pendingType = 'normal'
    }
  }

  return result.filter(e => e.sets.length > 0)
}

// ── Date detection ────────────────────────────────────────────────────────────

export function detectDateFromText(text: string): string | null {
  const now = new Date()
  for (const line of text.split('\n')) {
    const l = line.toLowerCase()
    if (/\byesterday\b/.test(l)) {
      const d = new Date(now); d.setDate(d.getDate() - 1)
      return d.toISOString().slice(0, 16)
    }
    const dayMatch = /last\s+(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)/i.exec(l)
    if (dayMatch) {
      const days = ['sun','mon','tue','wed','thu','fri','sat']
      const target = days.findIndex(d => dayMatch[1].toLowerCase().startsWith(d))
      if (target >= 0) {
        const d = new Date(now)
        const diff = (d.getDay() - target + 7) % 7 || 7
        d.setDate(d.getDate() - diff)
        return d.toISOString().slice(0, 16)
      }
    }
    // "March 5" or "5 March" or "5/3" or "03/05"
    const monthMatch = /\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i.exec(line) ||
                       /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})\b/i.exec(line)
    if (monthMatch) {
      const months: Record<string,number> = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11}
      const a = monthMatch[1], b = monthMatch[2]
      const num = parseInt(a) || parseInt(b)
      const ms = isNaN(parseInt(a)) ? a : b
      const month = months[ms.slice(0,3).toLowerCase()]
      if (month !== undefined && num >= 1 && num <= 31) {
        const d = new Date(now.getFullYear(), month, num, 12, 0, 0)
        if (d > now) d.setFullYear(d.getFullYear() - 1)
        return d.toISOString().slice(0, 16)
      }
    }
  }
  return null
}

// ── Shared prompt ─────────────────────────────────────────────────────────────

function buildPrompt(text: string): string {
  return `Parse this gym workout log into structured JSON. Return ONLY a JSON array, no markdown.

Each exercise: { "name": string, "sets": [...] }
Each set: { "weight": string, "reps": string, "type": "normal"|"warmup"|"dropset"|"failure"|"halfrep", "restBefore": number|null, "dropEntries": [{"weight":string,"reps":string}]|null }

Rules:
- weight/reps are plain number strings ("100", "8") or "BW" for bodyweight
- dropsets/half-reps: use dropEntries for ALL entries (including first drop)
- restBefore = seconds of rest before that set, or null
- half reps = type "halfrep"

Workout log:
${text}

Return ONLY the JSON array:`
}

function extractParsed(content: string): ParsedExercise[] | null {
  const jsonMatch = /\[[\s\S]*\]/.exec(content)
  if (!jsonMatch) return null
  try {
    const arr = JSON.parse(jsonMatch[0])
    if (Array.isArray(arr) && arr.length > 0) return arr as ParsedExercise[]
  } catch {}
  return null
}

// ── Vertex AI (Google Cloud) parsing ─────────────────────────────────────────

export async function parseWithVertexAI(text: string): Promise<ParsedExercise[]> {
  try {
    const { callVertexAI } = await import('./googleAuth')
    const content = await callVertexAI(buildPrompt(text))
    const parsed = extractParsed(content)
    if (parsed) return parsed
  } catch (e) {
    console.warn('Vertex AI parse failed, falling back to local parser:', e)
  }
  return parseWorkoutText(text)
}

// ── Gemini AI Studio (API key) parsing ────────────────────────────────────────

export async function parseWithGemini(text: string, apiKey: string): Promise<ParsedExercise[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(text) }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const content: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const parsed = extractParsed(content)
    if (parsed) return parsed
  } catch (e) {
    console.warn('Gemini parse failed, falling back to local parser:', e)
  }
  return parseWorkoutText(text)
}
