import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'
import { MgNavbar } from '../components/MgNavbar'

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ medicines: 0, alerts: 0, visits: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    const fetchStats = async () => {
      try {
        const [medsRes, alertsRes, visitsRes] = await Promise.allSettled([
          api.get('/medicines', { params: { patient_id: user.id } }),
          api.get('/alerts', { params: { patient_id: user.id } }),
          api.get('/calendar', { params: { patient_id: user.id } }),
        ])

        const meds = medsRes.status === 'fulfilled' ? medsRes.value.data.data : []
        const alerts = alertsRes.status === 'fulfilled' ? alertsRes.value.data.data : []
        const visits = visitsRes.status === 'fulfilled' ? visitsRes.value.data.data?.visits || [] : []

        setStats({
          medicines: meds.filter(m => m.status === 'active').length,
          alerts: alerts.filter(a => a.status === 'shown').length,
          visits: visits,
        })
      } catch { /* graceful fallback */ }
      setLoading(false)
    }
    fetchStats()
  }, [user])

  return (
    <>
      {/* Main Content */}
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 md:px-16 py-12 md:py-16 animate-fade-in">
        
        {/* Welcome Header */}
        <div className="mb-12 text-left">
          <h1 className="font-sans text-4xl font-bold text-slate-900 mb-2">
            Welcome{user?.name ? `, ${user.name}` : ''}
          </h1>
          <p className="text-sm text-slate-500">A summary of active clinical protocols.</p>
        </div>

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
          <button className="bg-[#0F766E] text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-accent-hover transition-colors shadow-sm cursor-pointer whitespace-nowrap">
            Scan Prescription
          </button>
        </div>

        {/* Upcoming Appointments Section */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-8 md:p-12 text-left shadow-sm">
          <h3 className="font-sans text-2xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">
            Upcoming Appointments
          </h3>
          
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
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
      </main>

      {/* Footer */}
      <footer className="bg-[#f6fafa] border-t border-slate-200">
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
