import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'
import { MgNavbar } from '../components/MgNavbar'

export default function CaregiverDashboard() {
  const { user, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [links, setLinks] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    fetchLinks()
  }, [user])

  const fetchLinks = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/caregivers/patients')
      const patients = res.data.data
      setLinks(patients)
      
      // Auto-select first patient if available
      if (patients.length > 0) {
        handlePatientSelect(patients[0].patient_id, patients)
      } else {
        setLoading(false)
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch patients list')
      setLoading(false)
    }
  }

  const handlePatientSelect = async (patientId, patientsList = links) => {
    const selected = patientsList.find(p => p.patient_id === patientId)
    setSelectedPatient(selected)
    if (!selected) return

    setLoading(true)
    setError('')
    try {
      const [medsRes, alertsRes] = await Promise.allSettled([
        api.get('/medicines', { params: { patient_id: patientId } }),
        api.get('/alerts', { params: { patient_id: patientId } }),
      ])

      if (medsRes.status === 'fulfilled') {
        setMedicines(medsRes.value.data.data)
      } else {
        setMedicines([])
      }

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value.data.data)
      } else {
        setAlerts([])
      }
    } catch {
      setError('Error loading patient data')
    } finally {
      setLoading(false)
    }
  }

  const activeMeds = medicines.filter(m => m.status === 'active')
  const activeAlerts = alerts.filter(a => a.status === 'shown')
  const hasFullAccess = selectedPatient?.permission_level === 'full_view'

  return (
    <>
      {/* Main Content */}
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 md:px-16 py-12 animate-fade-in">
        
        {/* Caregiver Context Header */}
        <header className="mb-12 border-b border-slate-200 pb-8 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg mb-4 border border-slate-200">
                <span className="material-symbols-outlined text-[16px] text-slate-500">visibility</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Read-Only View</span>
              </div>
              <h1 className="font-sans text-5xl font-bold text-slate-900 mb-2">Caregiver Dashboard</h1>
              <p className="text-sm text-slate-500">
                Viewing as caregiver for <strong className="text-slate-900 font-semibold">{selectedPatient ? selectedPatient.patient_name : 'No Patient Selected'}</strong>
              </p>
            </div>
            
            {/* Patient Switcher Dropdown */}
            {links.length > 0 && (
              <div className="relative w-full md:w-64">
                <select 
                  id="patient-select"
                  value={selectedPatient?.patient_id || ''}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="block w-full pl-4 pr-10 py-3 text-sm border border-slate-200 focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] rounded-lg bg-white appearance-none cursor-pointer"
                >
                  {links.map((link) => (
                    <option key={link.patient_id} value={link.patient_id}>
                      {link.patient_name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            )}
          </div>
        </header>

        {error && (
          <div className="error-banner mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-left">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : !selectedPatient ? (
          <div className="text-left py-12 border border-slate-200 border-dashed rounded-xl bg-white p-8">
            <p className="text-sm text-slate-500">You are not linked as a caregiver for any patients yet.</p>
          </div>
        ) : (
          <div className="text-left">
            
            {/* Bento metrics summary */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
              
              {/* Active Medicines Bento Card */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-8 flex flex-col justify-between h-48 shadow-sm">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Medicines</h4>
                  <span className="material-symbols-outlined text-slate-400">medication</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-sans text-5xl font-bold text-slate-900 leading-none">
                    {hasFullAccess ? activeMeds.length : '🔒'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {hasFullAccess ? 'Prescriptions' : 'Access Restricted'}
                  </span>
                </div>
              </div>

              {/* Interaction Alerts Bento Card */}
              <div className={`bg-white border border-slate-200/80 rounded-xl p-8 flex flex-col justify-between h-48 shadow-sm relative overflow-hidden border-l-4 ${
                activeAlerts.length > 0 ? 'border-l-red-600' : 'border-l-teal-600'
              }`}>
                <div className="flex justify-between items-start z-10 relative">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${
                    activeAlerts.length > 0 ? 'text-red-700' : 'text-teal-700'
                  }`}>
                    Interaction Alerts
                  </h4>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                    activeAlerts.length > 0 ? 'bg-red-50 text-red-800' : 'bg-teal-50 text-teal-800'
                  }`}>
                    {activeAlerts.length > 0 ? 'Attention Needed' : 'All Clear'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 z-10 relative">
                  <span className="font-sans text-5xl font-bold text-slate-900 leading-none">
                    {activeAlerts.length}
                  </span>
                  <span className="text-xs text-slate-500">
                    {activeAlerts.length > 0 ? 'Potential Risks Detected' : 'No Risks Detected'}
                  </span>
                </div>
              </div>

            </section>

            {/* Current Regimen Details */}
            {hasFullAccess ? (
              <section>
                <div className="flex justify-between items-end mb-8">
                  <h2 className="font-sans text-2xl font-bold text-slate-900">Current Regimen</h2>
                  <span className="text-xs text-slate-400">Adherence monitoring active</span>
                </div>

                <div className="flex flex-col gap-4">
                  {medicines.map((med) => {
                    const isActive = med.status === 'active'
                    return (
                      <div 
                        key={med.id}
                        className={`bg-white border border-slate-200/80 rounded-xl p-6 flex flex-col md:flex-row gap-6 md:items-center justify-between shadow-sm transition-all duration-200 hover:border-slate-400 ${
                          isActive ? '' : 'opacity-70 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                            <span className="material-symbols-outlined text-slate-500">pill</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className={`text-lg font-semibold ${isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                                {med.brand_name} {med.dosage}
                              </h3>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                                isActive ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {isActive ? 'Active' : 'Completed'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">Oral Medication regimen</p>
                          </div>
                        </div>

                        <div className="flex flex-col md:items-end gap-1 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 mt-2 md:mt-0">
                          <span className="text-sm font-semibold text-slate-900">{med.frequency}</span>
                          <span className="text-xs text-slate-500">
                            {isActive ? `Since: ${new Date(med.created_at).toLocaleDateString()}` : 'Course finished'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : (
              <section className="py-12 border border-slate-200 border-dashed rounded-xl bg-white p-8 text-center flex flex-col items-center">
                <span className="material-symbols-outlined text-5xl text-slate-400 mb-4">lock</span>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Restricted Access Protocol</h3>
                <p className="text-sm text-slate-500 max-w-md">
                  This patient has configured their caregiver permission level to <strong>Alerts Only</strong>. Full regimen details and drug catalogs are locked in compliance with patient consent settings.
                </p>
              </section>
            )}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-[#f6fafa] border-t border-slate-200 mt-auto">
        <div className="w-full py-12 px-6 md:px-16 flex flex-col md:flex-row justify-between items-center gap-4 max-w-[1200px] mx-auto text-sm text-slate-500">
          <div className="font-serif text-lg font-bold text-slate-900 mb-4 md:mb-0">
            MedGuard
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/privacy" className="hover:text-[#0F766E] transition-colors">Privacy Policy</Link>
            <a className="hover:text-[#0F766E] transition-colors" href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
            <a className="hover:text-[#0F766E] transition-colors" href="#" onClick={(e) => e.preventDefault()}>Clinical Guidelines</a>
            <a className="hover:text-[#0F766E] transition-colors" href="#" onClick={(e) => e.preventDefault()}>Contact Support</a>
          </div>
          <div className="text-xs text-slate-400 mt-4 md:mt-0">
            © 2026 MedGuard AI. Clinical Excellence in Medication Safety.
          </div>
        </div>
      </footer>
    </>
  )
}
