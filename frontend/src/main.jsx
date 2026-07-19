import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'

import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'

/**
 * reCAPTCHA site key — must match a key registered for medguard.living
 * in Google's reCAPTCHA admin console (https://www.google.com/recaptcha/admin).
 *
 * Set via VITE_RECAPTCHA_SITE_KEY in your .env / Vercel environment variables.
 * Vite bakes VITE_-prefixed vars at build time, so any change requires a
 * fresh production build/deploy (Vercel redeploy) to take effect.
 */
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LdNflstAAAAAJ6VEmCCY8NHWgOJUFJ878qJmXWQ'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </GoogleReCaptchaProvider>
  </StrictMode>,
)
