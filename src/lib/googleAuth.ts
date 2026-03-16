/**
 * Google Cloud OAuth2 (PKCE) + Vertex AI helpers
 *
 * Setup in Google Cloud Console:
 *  1. Enable Vertex AI API on your project
 *  2. Create OAuth2 credentials: APIs & Services → Credentials → Create OAuth client ID
 *     Type: Web application
 *     Authorised redirect URIs: https://your-domain/auth/callback
 *  3. Copy Client ID + Client Secret into Settings
 */

const AUTH_ENDPOINT  = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_URL   = 'https://www.googleapis.com/oauth2/v3/userinfo'
const SCOPE          = 'https://www.googleapis.com/auth/cloud-platform'

const K = {
  projectId:     'gcp_project_id',
  clientId:      'gcp_client_id',
  clientSecret:  'gcp_client_secret',
  accessToken:   'gcp_access_token',
  refreshToken:  'gcp_refresh_token',
  expiry:        'gcp_token_expiry',
  userEmail:     'gcp_user_email',
  codeVerifier:  'gcp_code_verifier',
  oauthState:    'gcp_oauth_state',
} as const

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function b64url(buf: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function sha256(s: string): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return new Uint8Array(hash)
}

function rand(n = 32): Uint8Array {
  const a = new Uint8Array(n); crypto.getRandomValues(a); return a
}

// ── Storage helpers ───────────────────────────────────────────────────────────

export interface GCPCredentials {
  projectId: string
  clientId: string
  clientSecret: string
}

export function loadCredentials(): GCPCredentials {
  return {
    projectId:    localStorage.getItem(K.projectId)    || '',
    clientId:     localStorage.getItem(K.clientId)     || '',
    clientSecret: localStorage.getItem(K.clientSecret) || '',
  }
}

export function saveCredentials(c: GCPCredentials) {
  localStorage.setItem(K.projectId,    c.projectId.trim())
  localStorage.setItem(K.clientId,     c.clientId.trim())
  localStorage.setItem(K.clientSecret, c.clientSecret.trim())
}

export function isConnected(): boolean {
  return !!localStorage.getItem(K.accessToken)
}

export function connectedEmail(): string {
  return localStorage.getItem(K.userEmail) || ''
}

export function disconnect() {
  ;[K.accessToken, K.refreshToken, K.expiry, K.userEmail].forEach(k => localStorage.removeItem(k))
}

// ── OAuth2 PKCE flow ──────────────────────────────────────────────────────────

/**
 * Opens a popup to Google OAuth. Returns a promise that resolves once the user
 * authenticates (or rejects on error/timeout). Listens for a postMessage from
 * the /auth/callback page.
 */
export async function connectGoogleAccount(clientId: string, clientSecret: string): Promise<{ ok: boolean; error?: string }> {
  const verifier = b64url(rand(32))
  const challenge = b64url(await sha256(verifier))
  const state     = b64url(rand(16))

  sessionStorage.setItem(K.codeVerifier, verifier)
  sessionStorage.setItem(K.oauthState,   state)

  const redirectUri = `${window.location.origin}/auth/callback`
  const params = new URLSearchParams({
    client_id:             clientId,
    redirect_uri:          redirectUri,
    response_type:         'code',
    scope:                 SCOPE,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    state,
    access_type:           'offline',
    prompt:                'consent',
  })

  const W = 520, H = 620
  const left = Math.round((window.screen.width  - W) / 2)
  const top  = Math.round((window.screen.height - H) / 2)
  const popup = window.open(
    `${AUTH_ENDPOINT}?${params}`,
    'gcp_oauth',
    `width=${W},height=${H},left=${left},top=${top},toolbar=no,menubar=no`
  )
  if (!popup) return { ok: false, error: 'Popup blocked — allow popups for this site and try again.' }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler)
      resolve({ ok: false, error: 'Authentication timed out.' })
    }, 5 * 60 * 1000) // 5 min

    async function handler(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) return
      if (ev.data?.type !== 'gcp_oauth_callback') return
      clearTimeout(timeout)
      window.removeEventListener('message', handler)

      const { code, state: returnedState, error } = ev.data
      if (error) { resolve({ ok: false, error }); return }

      const storedState    = sessionStorage.getItem(K.oauthState)
      const storedVerifier = sessionStorage.getItem(K.codeVerifier)
      sessionStorage.removeItem(K.oauthState)
      sessionStorage.removeItem(K.codeVerifier)

      if (returnedState !== storedState || !storedVerifier) {
        resolve({ ok: false, error: 'OAuth state mismatch — please try again.' }); return
      }

      const ok = await exchangeCode(code, clientId, clientSecret, redirectUri, storedVerifier)
      resolve(ok ? { ok: true } : { ok: false, error: 'Token exchange failed — check your Client Secret.' })
    }

    window.addEventListener('message', handler)
  })
}

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<boolean> {
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: codeVerifier }),
    })
    if (!res.ok) { console.error('Token exchange:', await res.text()); return false }
    const d = await res.json()
    localStorage.setItem(K.accessToken,  d.access_token)
    localStorage.setItem(K.expiry, String(Date.now() + (d.expires_in || 3600) * 1000))
    if (d.refresh_token) localStorage.setItem(K.refreshToken, d.refresh_token)

    // Fetch user email for display
    try {
      const ui = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${d.access_token}` } })
      const uiData = await ui.json()
      if (uiData.email) localStorage.setItem(K.userEmail, uiData.email)
    } catch {}

    return true
  } catch (e) {
    console.error('exchangeCode:', e)
    return false
  }
}

// ── Token management ──────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string | null> {
  const token        = localStorage.getItem(K.accessToken)
  const expiry       = parseInt(localStorage.getItem(K.expiry) || '0')
  const refreshToken = localStorage.getItem(K.refreshToken)
  const clientId     = localStorage.getItem(K.clientId)
  const clientSecret = localStorage.getItem(K.clientSecret)

  if (!token) return null

  // Still valid for > 60 s
  if (Date.now() < expiry - 60_000) return token

  // Try to refresh
  if (!refreshToken || !clientId || !clientSecret) return token

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
    })
    if (!res.ok) return token
    const d = await res.json()
    localStorage.setItem(K.accessToken, d.access_token)
    localStorage.setItem(K.expiry, String(Date.now() + (d.expires_in || 3600) * 1000))
    return d.access_token
  } catch {
    return token
  }
}

// ── Vertex AI ─────────────────────────────────────────────────────────────────

export async function callVertexAI(prompt: string): Promise<string> {
  const projectId = localStorage.getItem(K.projectId)
  if (!projectId) throw new Error('No GCP Project ID configured.')

  const token = await getAccessToken()
  if (!token) throw new Error('Not authenticated with Google Cloud.')

  const loc   = 'us-central1'
  const model = 'gemini-2.0-flash'
  const url   = `https://${loc}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${loc}/publishers/google/models/${model}:generateContent`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Vertex AI HTTP ${res.status}`)
  }

  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}
