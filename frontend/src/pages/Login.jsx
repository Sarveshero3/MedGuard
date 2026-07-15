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
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (showMfa) {
        // MFA Verification Step
        const res = await api.post('/auth/verify-mfa', {
          mfaToken: mfaToken,
          otp: mfaOtp,
        })
        login(res.data.data.token)
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
        login(res.data.data.token)
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
    <div className="min-h-screen bg-[#f6fafa] mg-grid-bg flex items-center justify-center p-6 md:p-16 font-sans text-[#181c1d]">
      <main className="w-full max-w-[480px] bg-white/72 backdrop-blur-[20px] rounded-2xl border border-white/50 p-8 md:p-12 relative overflow-hidden shadow-2xl">
        
        {/* Header */}
        <header className="text-center mb-8 auth-header">
          <h1 className="font-serif text-5xl font-bold text-slate-900 mb-2">MedGuard</h1>
          <p className="font-sans text-sm text-slate-500">Clinical Excellence in Medication Safety.</p>
        </header>

        {/* Shared MgTabs Component */}
        <MgTabs 
          value={isSignup ? 'signup' : 'login'} 
          onValueChange={handleTabChange} 
          tabs={tabList} 
        />

        {error && (
          <div className="error-banner mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {showMfa ? (
            // MFA OTP verification form
            <div className="space-y-4 text-left">
              <div className="bg-[#f0f9ff] border-l-4 border-sky-500 p-4 rounded-r-lg mb-6">
                <h3 className="text-sm font-semibold text-sky-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">mail</span>
                  Security Code Required
                </h3>
                <p className="text-xs text-sky-700 mt-1">
                  We have sent a 6-digit security code to your email. Please enter it below to complete your login.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mfa_otp">Verification Code</Label>
                <Input
                  id="mfa_otp"
                  type="text"
                  required
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  value={mfaOtp}
                  onChange={(e) => setMfaOtp(e.target.value)}
                  className="font-mono text-center text-lg tracking-widest"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-[#0F766E] text-white rounded-lg py-3 font-semibold text-sm hover:bg-accent-hover transition-colors cursor-pointer"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <div className="flex justify-between items-center mt-4 px-1">
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
                  <div className="space-y-3">
                    <Label className="block text-sm font-semibold text-[#0B1F33]">I am a...</Label>
                    <div className="grid grid-cols-2 gap-4">
                      
                      {/* Patient Radio Option */}
                      <label className="cursor-pointer relative">
                        <input
                          type="radio"
                          name="role"
                          value="patient"
                          checked={formData.role === 'patient'}
                          onChange={() => setFormData({ ...formData, role: 'patient' })}
                          className="peer sr-only"
                        />
                        <div className="border border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center gap-2 peer-checked:border-[#0F766E] peer-checked:bg-[#f6fafa] transition-all hover:bg-slate-50/50 min-h-[100px]">
                          <span className="material-symbols-outlined text-3xl text-slate-400 peer-checked:text-[#0F766E]">
                            person
                          </span>
                          <span className="text-sm font-semibold text-slate-800">Patient</span>
                        </div>
                      </label>

                      {/* Caregiver Radio Option */}
                      <label className="cursor-pointer relative">
                        <input
                          type="radio"
                          name="role"
                          value="caregiver"
                          checked={formData.role === 'caregiver'}
                          onChange={() => setFormData({ ...formData, role: 'caregiver' })}
                          className="peer sr-only"
                        />
                        <div className="border border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center gap-2 peer-checked:border-[#0F766E] peer-checked:bg-[#f6fafa] transition-all hover:bg-slate-50/50 min-h-[100px]">
                          <span className="material-symbols-outlined text-3xl text-slate-400 peer-checked:text-[#0F766E]">
                            medical_services
                          </span>
                          <span className="text-sm font-semibold text-slate-800">Caregiver</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Caregiver Patient linking OTP */}
                  {formData.role === 'caregiver' && (
                    <div className="space-y-1.5 text-left">
                      <Label htmlFor="linking_otp">Patient Link Code (OTP)</Label>
                      <Input
                        id="linking_otp"
                        type="text"
                        required
                        placeholder="Enter patient link code"
                        maxLength={6}
                        value={formData.linking_otp}
                        onChange={(e) => setFormData({ ...formData, linking_otp: e.target.value })}
                        className="font-mono text-center tracking-widest text-base"
                      />
                    </div>
                  )}

                  {/* Name Field */}
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      required
                      placeholder="Enter your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* Email Address */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder={isSignup ? "Create a password" : "Enter your password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              {/* Remember me or DPDP Consent Checkbox */}
              {!isSignup ? (
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <Checkbox id="remember-me" />
                    <span className="text-xs text-slate-500">Remember me</span>
                  </label>
                  <a
                    className="text-xs font-semibold text-[#0F766E] hover:text-accent-hover transition-colors"
                    href="#"
                    onClick={(e) => e.preventDefault()}
                  >
                    Forgot password?
                  </a>
                </div>
              ) : (
                <label className="flex items-start space-x-3 cursor-pointer text-left">
                  <Checkbox 
                    id="consent"
                    checked={formData.consentGranted}
                    onCheckedChange={(val) => setFormData({ ...formData, consentGranted: val })}
                    required
                  />
                  <span className="text-xs text-slate-500 leading-snug">
                    I consent to the collection and processing of my health data in accordance with the DPDP Act and the Privacy Policy.
                  </span>
                </label>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0F766E] text-white rounded-lg py-3 font-semibold text-sm hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
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
