import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Common stats state
  const [stats, setStats] = useState({ medicines: 0, alerts: 0, visits: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Caregiver-specific state
  const [linkedPatients, setLinkedPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedPatientName, setSelectedPatientName] = useState('')

  // Patient-specific caregiver link state
  const [linkedCaregivers, setLinkedCaregivers] = useState([])
  const [otpCode, setOtpCode] = useState('')
  const [otpExpiry, setOtpExpiry] = useState(null)
  const [generatingOtp, setGeneratingOtp] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  // Fetch initial caregiver links or patient links
  useEffect(() => {
    if (!user) return
    const initDashboard = async () => {
      setLoading(true)
      try {
        const res = await api.get('/caregivers/links')
        if (user.role === 'caregiver') {
          const patients = res.data.data
          setLinkedPatients(patients)
          if (patients.length > 0) {
            setSelectedPatientId(patients[0].patient_id)
            setSelectedPatientName(patients[0].name)
          } else {
            setLoading(false)
          }
        } else {
          // Patient: load linked caregivers
          setLinkedCaregivers(res.data.data)
        }
      } catch (err) {
        setError('Failed to load caregiver linkage details.')
      }
    }
    initDashboard()
  }, [user])

  // Fetch statistics based on selected patient (for caregiver) or self (for patient)
  useEffect(() => {
    if (!user) return
    const targetId = user.role === 'caregiver' ? selectedPatientId : user.id
    if (!targetId) return

    const fetchStats = async () => {
      setLoading(true)
      try {
        const [medsRes, alertsRes, visitsRes] = await Promise.allSettled([
          api.get('/medicines', { params: { patient_id: targetId } }),
          api.get('/alerts', { params: { patient_id: targetId } }),
          api.get('/calendar', { params: { patient_id: targetId } }),
        ])

        const meds = medsRes.status === 'fulfilled' ? medsRes.value.data.data : []
        const alerts = alertsRes.status === 'fulfilled' ? alertsRes.value.data.data : []
        const visits = visitsRes.status === 'fulfilled' ? visitsRes.value.data.data?.visits || [] : []

        setStats({
          medicines: meds.filter(m => m.status === 'active').length,
          alerts: alerts.filter(a => a.status === 'shown').length,
          visits: visits,
        })
      } catch {
        setError('Failed to refresh data summaries.')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [user, selectedPatientId])

  // Patient: Generate caregiver OTP
  const handleGenerateOtp = async () => {
    setGeneratingOtp(true)
    setError('')
    try {
      const res = await api.post('/caregivers/otp')
      setOtpCode(res.data.data.otp)
      setOtpExpiry(new Date(res.data.data.expires_at))
    } catch (err) {
      setError('Could not generate linking code.')
    } finally {
      setGeneratingOtp(false)
    }
  }

  // Patient: Revoke a caregiver link
  const handleRevokeCaregiver = async (linkId) => {
    if (!window.confirm('Are you sure you want to revoke this caregiver access?')) return
    setError('')
    try {
      await api.delete(`/caregivers/links/${linkId}`)
      setLinkedCaregivers(prev => prev.filter(cg => cg.id !== linkId))
    } catch {
      setError('Failed to revoke caregiver access.')
    }
  }

  const handlePatientChange = (e) => {
    const pId = e.target.value
    setSelectedPatientId(pId)
    const patientObj = linkedPatients.find(p => p.patient_id === pId)
    setSelectedPatientName(patientObj ? patientObj.name : '')
  }

  if (authLoading || !user) {
    return (
      <div className="flex-grow w-full max-w-[1200px] mx-auto px-6 md:px-16 py-12 md:py-16 text-left">
        <Skeleton className="h-12 w-64 mb-6" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <>
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 md:px-16 py-12 md:py-16 animate-fade-in text-left">
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Dashboard Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="font-sans text-4xl font-bold text-slate-900 mb-2">
              Welcome, {user.name}
            </h1>
            <p className="text-sm text-slate-500">
              {user.role === 'caregiver' 
                ? `Viewing data as caregiver for ${selectedPatientName || 'your patient'}`
                : 'A summary of active clinical protocols.'
              }
            </p>
          </div>

          {/* Caregiver Patient Switcher */}
          {user.role === 'caregiver' && linkedPatients.length > 0 && (
            <div className="relative w-full md:w-64">
              <select
                id="patient-select"
                value={selectedPatientId}
                onChange={handlePatientChange}
                className="block w-full pl-4 pr-10 py-3 text-sm border border-slate-200 focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] rounded-lg bg-white appearance-none cursor-pointer font-medium"
              >
                {linkedPatients.map(lp => (
                  <option key={lp.patient_id} value={lp.patient_id}>
                    {lp.name} ({lp.email})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
          )}
        </div>

        {user.role === 'caregiver' && linkedPatients.length === 0 ? (
          <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center mb-16">
            <span className="material-symbols-outlined text-slate-300 text-6xl mb-4">people</span>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No patients linked</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              You are registered as a caregiver, but you have not linked to a patient. Please register a caregiver account using a patient's generated OTP.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              
              {/* Active Medicines Card */}
              <div 
                onClick={() => navigate('/medicines')}
                className="bg-white border border-slate-200/80 rounded-xl p-8 flex flex-col justify-between h-48 shadow-sm hover:shadow-md hover:border-[#0F766E]/30 transition-all duration-200 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <span className="material-symbols-outlined text-slate-400 text-3xl">pill</span>
                  {loading ? (
                    <Skeleton className="h-10 w-12" />
                  ) : (
                    <span className="font-sans text-5xl font-bold text-slate-900 leading-none">
                      {stats.medicines}
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Active Medicines</h4>
                  <p className="text-xs text-slate-500 mt-1">Current regimen adherence optimal.</p>
                </div>
              </div>

              {/* Interaction Alerts Card */}
              <div 
                onClick={() => navigate('/alerts')}
                className="bg-white border border-slate-200/80 rounded-xl p-8 flex flex-col justify-between h-48 shadow-sm hover:shadow-md hover:border-amber-500/30 transition-all duration-200 cursor-pointer relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-amber-500 opacity-0 group-hover:opacity-[0.02] transition-opacity duration-300"></div>
                <div className="flex justify-between items-start relative z-10">
                  <span className={`material-symbols-outlined text-3xl ${stats.alerts > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                    warning
                  </span>
                  {loading ? (
                    <Skeleton className="h-10 w-12" />
                  ) : (
                    <span className={`font-sans text-5xl font-bold leading-none ${stats.alerts > 0 ? 'text-amber-500' : 'text-slate-900'}`}>
                      {stats.alerts}
                    </span>
                  )}
                </div>
                <div className="relative z-10">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Interaction Alerts</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats.alerts > 0 ? 'Review advised for newly prescribed item.' : 'No interactions detected.'}
                  </p>
                </div>
              </div>

              {/* Upcoming Visits Card */}
              <div 
                onClick={() => navigate('/calendar')}
                className="bg-white border border-slate-200/80 rounded-xl p-8 flex flex-col justify-between h-48 shadow-sm hover:shadow-md hover:border-[#0F766E]/30 transition-all duration-200 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <span className="material-symbols-outlined text-slate-400 text-3xl">calendar_month</span>
                  {loading ? (
                    <Skeleton className="h-10 w-12" />
                  ) : (
                    <span className="font-sans text-5xl font-bold text-slate-900 leading-none">
                      {stats.visits.length}
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Upcoming Visits</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats.visits.length > 0 ? `Next consultation scheduled.` : 'No upcoming visits.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Action card for prescription upload */}
            <div 
              onClick={() => navigate('/upload')}
              className="mb-16 bg-[#0F766E]/5 mg-grid-bg border border-[#0F766E]/20 rounded-xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer hover:bg-[#0F766E]/10 transition-colors"
            >
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Have a new prescription?</h3>
                <p className="text-sm text-slate-600">Scan or upload prescription photos instantly to check drug-to-drug interactions.</p>
              </div>
              <button className="bg-[#0F766E] text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-[#0d645e] transition-colors shadow-sm cursor-pointer whitespace-nowrap">
                Scan Prescription
              </button>
            </div>

            {/* Upcoming Appointments Section */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-8 md:p-12 text-left shadow-sm mb-16">
              <h3 className="font-sans text-2xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">
                Upcoming Appointments
              </h3>
              
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : stats.visits.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming appointments scheduled.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {stats.visits.slice(0, 5).map((visit, index) => (
                    <div key={visit.id || index}>
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-4 hover:bg-slate-50/50 transition-colors duration-200 border-l-2 border-transparent hover:border-[#0F766E] px-4 rounded-r-lg group">
                        <div className="flex flex-col mb-4 md:mb-0">
                          <span className="text-sm font-semibold text-slate-900 mb-1">
                            {visit.specialty ? `${visit.specialty} Consult` : 'General Consult'}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                            {new Date(visit.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &nbsp;•&nbsp; {visit.doctor_name || 'Clinician'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-slate-500 px-3 py-1 bg-slate-100 rounded-md">
                            {new Date(visit.scheduled_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                          <button 
                            onClick={() => navigate('/calendar')}
                            className="text-xs font-semibold text-[#0F766E] opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                      {index < stats.visits.length - 1 && <div className="h-px w-full bg-slate-100"></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Patient Caregiver Management Interface */}
        {user.role === 'patient' && (
          <div className="bg-white border border-slate-200/80 rounded-xl p-8 md:p-12 text-left shadow-sm">
            <h3 className="font-sans text-2xl font-bold text-slate-900 mb-2">
              Caregiver Integration
            </h3>
            <p className="text-sm text-slate-500 mb-8">
              Enable family members to securely read active medication lists and receive drug safety alerts.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              
              {/* Linked Caregivers List */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Active Caregivers</h4>
                {linkedCaregivers.length === 0 ? (
                  <p className="text-sm text-slate-400">No caregivers linked to your account yet.</p>
                ) : (
                  <div className="space-y-4">
                    {linkedCaregivers.map(cg => (
                      <div key={cg.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-lg hover:bg-slate-50/50 transition-colors">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{cg.name}</p>
                          <p className="text-xs text-slate-500">{cg.email}</p>
                        </div>
                        <button
                          onClick={() => handleRevokeCaregiver(cg.id)}
                          className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors px-3 py-1.5 border border-red-200 hover:border-red-300 rounded bg-red-50/50"
                        >
                          Revoke Access
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate OTP Section */}
              <div className="border-t lg:border-t-0 lg:border-l border-slate-100 pt-8 lg:pt-0 lg:pl-12">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Link a Caregiver</h4>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Generate a one-time passcode (OTP). Your caregiver must input this passcode during signup to link directly with your profile.
                </p>

                {otpCode ? (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center max-w-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Passcode Code</p>
                    <p className="font-mono text-3xl font-bold text-[#0F766E] tracking-widest mb-2">{otpCode}</p>
                    <p className="text-[10px] text-slate-400">
                      Single-use only. Expires in 15 minutes.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateOtp}
                    disabled={generatingOtp}
                    className="bg-[#0F766E] hover:bg-[#0d645e] text-white px-6 py-3 rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                  >
                    {generatingOtp ? 'Generating...' : 'Generate Passcode'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#f6fafa] border-t border-slate-200">
        <div className="w-full py-12 px-6 md:px-16 flex flex-col md:flex-row justify-between items-center gap-4 max-w-[1200px] mx-auto text-sm text-slate-500">
          <div className="font-serif text-lg font-bold text-slate-900 mb-4 md:mb-0">
            MedGuard
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/privacy-policy" className="hover:text-[#0F766E] transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-[#0F766E] transition-colors">Terms of Service</Link>
            <Link to="/clinical-guidelines" className="hover:text-[#0F766E] transition-colors">Clinical Guidelines</Link>
            <Link to="/support" className="hover:text-[#0F766E] transition-colors">Contact Support</Link>
          </div>
          <div className="text-xs text-slate-400 mt-4 md:mt-0">
            © 2026 MedGuard AI. Clinical Excellence in Medication Safety.
          </div>
        </div>
      </footer>
    </>
  )
}
