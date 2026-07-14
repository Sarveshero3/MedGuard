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
  })
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const endpoint = isSignup ? '/auth/register' : '/auth/login'
      
      const payload = isSignup ? {
        name: formData.name || formData.email.split('@')[0],
        email: formData.email,
        password: formData.password,
        role: formData.role,
        consentGranted: formData.consentGranted,
      } : {
        email: formData.email,
        password: formData.password,
      }

      const res = await api.post(endpoint, payload)
      login(res.data.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong')
    }
  }

  const tabList = [
    { value: 'login', label: 'Sign In' },
    { value: 'signup', label: 'Create Account' }
  ]

  const handleTabChange = (val) => {
    setIsSignup(val === 'signup')
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
          <div className="error-banner mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
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
              minLength={8}
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
            className="w-full bg-[#0F766E] text-white rounded-lg py-3 font-semibold text-sm hover:bg-accent-hover transition-colors cursor-pointer"
          >
            {isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </main>
    </div>
  )
}
