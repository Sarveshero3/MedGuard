import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { MgTabs } from '../components/ui/MgTabs'
import { Skeleton } from '../components/ui/skeleton'
import { MgNavbar } from '../components/MgNavbar'

export default function MedicineList() {
  const { user, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('active') // 'active' | 'discontinued'

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    fetchMedicines()
  }, [user])

  const fetchMedicines = async () => {
    setLoading(true)
    try {
      const res = await api.get('/medicines', { params: { patient_id: user.id } })
      setMedicines(res.data.data)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch medicines')
    } finally {
      setLoading(false)
    }
  }

  const toggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'discontinued' : 'active'
      await api.put(`/medicines/${id}/status`, { status: newStatus })
      fetchMedicines()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update medicine status')
    }
  }

  const filteredMeds = medicines.filter(m => m.status === filter)

  const tabList = [
    { value: 'active', label: 'Active Prescriptions' },
    { value: 'discontinued', label: 'History' }
  ]

  return (
    <>
      {/* Main Content */}
      <main className="flex-grow w-full px-6 md:px-16 max-w-[1200px] mx-auto py-12 animate-fade-in">
        
        {/* Header Section */}
        <div className="mb-12 text-left">
          <h1 className="font-sans text-5xl font-bold text-slate-900 mb-4">Medications</h1>
          <p className="text-sm text-slate-500 max-w-2xl">Manage your active prescriptions and review clinical history.</p>
        </div>

        {error && (
          <div className="error-banner mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-left">
            {error}
          </div>
        )}

        {/* Shared MgTabs Component */}
        <MgTabs 
          value={filter}
          onValueChange={setFilter}
          tabs={tabList}
        />

        {/* Medicine List Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : filteredMeds.length === 0 ? (
          <div className="text-left py-12 border border-slate-200 border-dashed rounded-xl bg-white p-8">
            <p className="text-sm text-slate-500">No {filter} medications found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {filteredMeds.map((med) => {
              const isActive = med.status === 'active'
              return (
                <div 
                  key={med.id} 
                  className={`border border-slate-200/80 rounded-xl p-6 flex flex-col justify-between hover:border-slate-400 transition-colors shadow-sm ${
                    isActive ? 'bg-white' : 'bg-slate-50/70 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <h2 className={`text-xl font-bold ${isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                        {med.brand_name}
                      </h2>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                        isActive 
                          ? 'bg-teal-50 border border-teal-200 text-teal-800' 
                          : 'bg-slate-100 border border-slate-200 text-slate-500'
                      }`}>
                        {med.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-6">
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-lg">medication</span>
                        Dosage: {med.dosage}
                      </p>
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-lg">schedule</span>
                        Frequency: {med.frequency}
                      </p>
                      {isActive ? (
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 text-lg">calendar_today</span>
                          Since: {new Date(med.added_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 text-lg">history</span>
                          Ended: {med.course_end_date ? new Date(med.course_end_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                    {isActive ? (
                      <button 
                        onClick={() => toggleStatus(med.id, med.status)}
                        className="text-[#ba1a1a] hover:text-white hover:bg-[#ba1a1a] border border-[#ba1a1a] font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">block</span>
                        Discontinue
                      </button>
                    ) : (
                      <button 
                        onClick={() => toggleStatus(med.id, med.status)}
                        className="text-[#0f766e] border border-[#0f766e] hover:bg-[#0f766e] hover:text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">restart_alt</span>
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
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
