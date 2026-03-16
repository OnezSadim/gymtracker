'use client'

import { useEffect } from 'react'

/**
 * OAuth2 callback page — opened as a popup during Google sign-in.
 * Extracts the auth code and relays it to the opener via postMessage.
 */
export default function OAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    const state  = params.get('state')
    const error  = params.get('error')

    if (window.opener) {
      window.opener.postMessage(
        { type: 'gcp_oauth_callback', code, state, error: error || null },
        window.location.origin
      )
      window.close()
    }
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontFamily: 'monospace',
    }}>
      <div style={{ color: '#C8FF00', fontSize: 18, letterSpacing: '0.1em' }}>CONNECTING</div>
      <div style={{ color: '#555', fontSize: 13 }}>You can close this window.</div>
    </div>
  )
}
