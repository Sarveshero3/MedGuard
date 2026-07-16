import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { MgTabs } from '../components/ui/MgTabs'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'

export default function Login() {
  const [isSignup, setIsSignup] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
    consentGranted: false,
    linking_otp: '',
  })
  
  // MFA (Gmail-style 2FA) states
  const [showMfa, setShowMfa] = useState(false)
  const [mfaToken, setMfaToken] = useState('')
  const [mfaOtp, setMfaOtp] = useState('')
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // JS Validation to prevent silent failures on incorrect input formats
    if (!showMfa) {
      if (isSignup && !formData.name) {
        setError('Full Name is required.')
        setLoading(false)
        return
      }
      if (!formData.email) {
        setError('Email Address is required.')
        setLoading(false)
        return
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email address (e.g., user@example.com).')
        setLoading(false)
        return
      }
      if (!formData.password) {
        setError('Password is required.')
        setLoading(false)
        return
      }
      if (isSignup && !formData.consentGranted) {
        setError('You must grant consent under the DPDP Act to register.')
        setLoading(false)
        return
      }
    }

    try {
      if (showMfa) {
        // MFA Verification Step
        const res = await api.post('/auth/verify-mfa', {
          mfaToken: mfaToken,
          otp: mfaOtp,
        })
        login(res.data.data.accessToken, res.data.data.refreshToken)
        navigate('/dashboard')
        return
      }

      const endpoint = isSignup ? '/auth/register' : '/auth/login'
      const payload = isSignup ? {
        name: formData.name || formData.email.split('@')[0],
        email: formData.email,
        password: formData.password,
        role: formData.role,
        consentGranted: formData.consentGranted,
        linking_otp: formData.role === 'caregiver' ? formData.linking_otp : undefined,
      } : {
        email: formData.email,
        password: formData.password,
      }

      const res = await api.post(endpoint, payload)

      if (!isSignup && res.data.data.requiresMfa) {
        // Login returned MFA requirement
        setMfaToken(res.data.data.mfaToken)
        setShowMfa(true)
      } else {
        // Normal login/register success
        login(res.data.data.accessToken, res.data.data.refreshToken)
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const tabList = [
    { value: 'login', label: 'Sign In' },
    { value: 'signup', label: 'Create Account' }
  ]

  const handleTabChange = (val) => {
    setIsSignup(val === 'signup')
    setShowMfa(false)
    setMfaOtp('')
    setMfaToken('')
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#f6fafa] mg-grid-bg flex items-center justify-center p-4 font-sans text-[#181c1d]">
      <main className="w-full max-w-[400px] bg-white/72 backdrop-blur-[20px] rounded-2xl border border-white/50 p-6 md:p-8 relative overflow-hidden shadow-2xl">
        
        {/* Header */}
        <header className="text-center mb-5 auth-header">
          <h1 className="font-serif text-4xl font-bold text-slate-900 mb-1">MedGuard</h1>
          <p className="font-sans text-xs text-slate-500">Clinical Excellence in Medication Safety.</p>
        </header>

        {/* Shared MgTabs Component */}
        <div className="mb-4">
          <MgTabs 
            value={isSignup ? 'signup' : 'login'} 
            onValueChange={handleTabChange} 
            tabs={tabList} 
          />
        </div>

        {error && (
          <div className="error-banner mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {showMfa ? (
            // MFA OTP verification form
            <div className="space-y-3 text-left">
              <div className="bg-[#f0f9ff] border-l-4 border-sky-500 p-3 rounded-r-lg mb-4">
                <h3 className="text-xs font-semibold text-sky-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">mail</span>
                  Security Code Required
                </h3>
                <p className="text-[11px] text-sky-700 mt-0.5 leading-relaxed">
                  We have sent a 6-digit security code to your email. Please enter it below to complete your login.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="mfa_otp" className="text-xs">Verification Code</Label>
                <Input
                  id="mfa_otp"
                  type="text"
                  required
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  value={mfaOtp}
                  onChange={(e) => setMfaOtp(e.target.value)}
                  className="font-mono text-center text-base tracking-widest py-2 h-9"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 bg-[#0F766E] text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-accent-hover transition-colors cursor-pointer"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <div className="flex justify-between items-center mt-3 px-1">
                <button
                  type="button"
                  onClick={async () => {
                    setError('')
                    setLoading(true)
                    try {
                      const res = await api.post('/auth/login', {
                        email: formData.email,
                        password: formData.password,
                      })
                      setMfaToken(res.data.data.mfaToken)
                      setMfaOtp('')
                      setError('A new security code has been sent to your email.')
                    } catch (err) {
                      setError(err.response?.data?.error?.message || 'Failed to resend code.')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  className="text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer"
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMfa(false)
                    setMfaOtp('')
                    setMfaToken('')
                    setError('')
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            // Normal Login / Registration form
            <>
              {/* Sign Up Fields */}
              {isSignup && (
                <>
                  {/* Custom Role Selector Cards */}
                  <div className="space-y-1.5">
                    <Label className="block text-xs font-semibold text-[#0B1F33]">I am a...</Label>
                    <div className="grid grid-cols-2 gap-2">
                      
                      {/* Patient Radio Option */}
                      <label className="cursor-pointer relative flex-1">
                        <input
                          type="radio"
                          name="role"
                          value="patient"
                          checked={formData.role === 'patient'}
                          onChange={() => setFormData({ ...formData, role: 'patient' })}
                          className="sr-only"
                        />
                        <div className={`border rounded-lg py-2 px-3 flex flex-row items-center justify-center gap-2 transition-all text-center ${
                          formData.role === 'patient'
                            ? 'border-[#0F766E] bg-[#f6fafa] text-[#0F766E] shadow-sm'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          <span className="text-xs font-semibold">Patient</span>
                        </div>
                      </label>

                      {/* Caregiver Radio Option */}
                      <label className="cursor-pointer relative flex-1">
                        <input
                          type="radio"
                          name="role"
                          value="caregiver"
                          checked={formData.role === 'caregiver'}
                          onChange={() => setFormData({ ...formData, role: 'caregiver' })}
                          className="sr-only"
                        />
                        <div className={`border rounded-lg py-2 px-3 flex flex-row items-center justify-center gap-2 transition-all text-center ${
                          formData.role === 'caregiver'
                            ? 'border-[#0F766E] bg-[#f6fafa] text-[#0F766E] shadow-sm'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M9 3.75a2.25 2.25 0 014.5 0M9 3.75h4.5m-9 9.75h18" />
                          </svg>
                          <span className="text-xs font-semibold">Caregiver</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Caregiver Patient linking OTP */}
                  {formData.role === 'caregiver' && (
                    <div className="space-y-1 text-left">
                      <Label htmlFor="linking_otp" className="text-xs">Patient Link Code (OTP)</Label>
                      <Input
                        id="linking_otp"
                        type="text"
                        required
                        placeholder="Enter patient link code"
                        maxLength={6}
                        value={formData.linking_otp}
                        onChange={(e) => setFormData({ ...formData, linking_otp: e.target.value })}
                        className="font-mono text-center tracking-widest text-sm py-1.5 h-9"
                      />
                    </div>
                  )}

                  {/* Name Field */}
                  <div className="space-y-1 text-left">
                    <Label htmlFor="name" className="text-xs">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      required
                      placeholder="Enter your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="py-1.5 h-9 text-sm"
                    />
                  </div>
                </>
              )}

              {/* Email Address */}
              <div className="space-y-1 text-left">
                <Label htmlFor="email" className="text-xs">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="py-1.5 h-9 text-sm"
                />
              </div>

              {/* Password */}
              <div className="space-y-1 text-left">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder={isSignup ? "Create a password" : "Enter your password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="py-1.5 pr-10 h-9 text-sm w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F766E] transition-colors flex items-center justify-center cursor-pointer focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <span className="material-symbols-outlined text-base">
                      {showPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember me or DPDP Consent Checkbox */}
              {!isSignup ? (
                <div className="flex items-center justify-between py-0.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <Checkbox id="remember-me" />
                    <span className="text-[11px] text-slate-500">Remember me</span>
                  </label>
                  <a
                    className="text-[11px] font-semibold text-[#0F766E] hover:text-accent-hover transition-colors"
                    href="#"
                    onClick={(e) => e.preventDefault()}
                  >
                    Forgot password?
                  </a>
                </div>
              ) : (
                <label className="flex items-start space-x-2 cursor-pointer text-left py-0.5">
                  <Checkbox 
                    id="consent"
                    checked={formData.consentGranted}
                    onCheckedChange={(val) => setFormData({ ...formData, consentGranted: val })}
                    required
                  />
                  <span className="text-[10px] text-slate-500 leading-snug">
                    I consent to the collection and processing of my health data in accordance with the DPDP Act and the Privacy Policy.
                  </span>
                </label>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0F766E] text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50 mt-1"
              >
                {loading ? 'Processing...' : (isSignup ? 'Create Account' : 'Sign In')}
              </button>
            </>
          )}
        </form>
      </main>
    </div>
  )
}
