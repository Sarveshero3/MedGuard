import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { MgTabs } from '../components/ui/MgTabs'
import { Skeleton } from '../components/ui/skeleton'
import { PrescriptionSourceModal } from '../components/PrescriptionSourceModal'
import { unescapeHTML } from '../lib/utils'

export default function MedicineList() {
  const { user, loading: authLoading, activePatientId } = useAuth()
  const navigate = useNavigate()
  
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState('active') // 'active' | 'discontinued'
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)
  const [layout, setLayout] = useState(() => localStorage.getItem('meds_layout') || 'grid')
  const [activeModalMed, setActiveModalMed] = useState(null)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    if (user.role === 'caregiver' && !activePatientId) {
      setLoading(false)
      return
    }
    fetchMedicines()
  }, [user, activePatientId])

  // Clear selection whenever filter tab changes
  useEffect(() => {
    setSelectedIds([])
  }, [filter])

  const fetchMedicines = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/medicines', { params: { patient_id: activePatientId } })
      setMedicines(res.data.data || [])
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch medicines')
    } finally {
      setLoading(false)
    }
  }

  const toggleStatus = async (id, currentStatus) => {
    setError('')
    setSuccess('')
    try {
      const newStatus = currentStatus === 'active' ? 'discontinued' : 'active'
      await api.put(`/medicines/${id}`, { status: newStatus })
      setSuccess(`Medicine ${newStatus === 'active' ? 'reactivated' : 'discontinued'} successfully.`)
      fetchMedicines()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update medicine status')
    }
  }

  const handleSelectToggle = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const filteredMeds = medicines.filter(m => m.status === filter)

  const handleSelectAllToggle = () => {
    if (selectedIds.length === filteredMeds.length) {
      // Unselect all
      setSelectedIds([])
    } else {
      // Select all in current filter
      setSelectedIds(filteredMeds.map(m => m.id))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected medicine(s)? This will also remove any related adherence logs and safety flags.`)) {
      return
    }

    setDeleting(true)
    setError('')
    setSuccess('')
    
    try {
      const res = await api.post('/medicines/batch-delete', {
        ids: selectedIds,
        patient_id: activePatientId
      })
      
      setSuccess(res.data.message || `Successfully deleted ${selectedIds.length} medicine(s).`)
      setSelectedIds([])
      fetchMedicines()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to delete selected medicines')
    } finally {
      setDeleting(false)
    }
  }

  const tabList = [
    { value: 'active', label: 'Active Prescriptions' },
    { value: 'discontinued', label: 'History' }
  ]

  return (
    <>
      {/* Main Content */}
      <main className="flex-grow w-full px-6 md:px-12 max-w-[1200px] mx-auto py-12 animate-fade-in text-left">
        
        {/* Header Section */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-sans text-4xl font-bold text-slate-900 mb-2">Medications</h1>
            <p className="text-sm text-slate-500 max-w-2xl font-medium">
              Manage your active prescriptions, review clinical history, and perform batch deletions.
            </p>
          </div>
          <div>
            <Link 
              to="/upload" 
              className="bg-[#0f766e] hover:bg-[#0d645c] text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all inline-flex items-center shadow-sm shadow-teal-700/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined mr-1.5 text-[18px]">cloud_upload</span>
              Upload Prescription
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold animate-fade-in flex items-center gap-2">
            <span className="material-symbols-outlined text-sm font-bold">error</span>
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-805 text-xs font-semibold animate-fade-in flex items-center gap-2">
            <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
            {success}
          </div>
        )}

        {/* Navigation Tabs and Layout Toggle */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <MgTabs 
            value={filter}
            onValueChange={setFilter}
            tabs={tabList}
          />
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLayout('grid');
                localStorage.setItem('meds_layout', 'grid');
              }}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                layout === 'grid' 
                  ? 'bg-slate-105 border-slate-350 text-[#0f766e] font-black' 
                  : 'bg-white border-slate-200 text-slate-505 hover:bg-slate-50'
              }`}
              title="Grid View"
            >
              <span className="material-symbols-outlined text-[18px] block">grid_view</span>
            </button>
            <button
              onClick={() => {
                setLayout('list');
                localStorage.setItem('meds_layout', 'list');
              }}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                layout === 'list' 
                  ? 'bg-slate-105 border-slate-350 text-[#0f766e] font-black' 
                  : 'bg-white border-slate-200 text-slate-505 hover:bg-slate-50'
              }`}
              title="List View"
            >
              <span className="material-symbols-outlined text-[18px] block">view_list</span>
            </button>
          </div>
        </div>

        {/* Bulk Actions Header Control Bar */}
        {filteredMeds.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 mb-4 rounded-xl bg-slate-50 border border-slate-200 text-sm">
            <div className="flex items-center gap-3 font-semibold text-slate-700">
              <input 
                type="checkbox"
                checked={filteredMeds.length > 0 && selectedIds.length === filteredMeds.length}
                onChange={handleSelectAllToggle}
                className="w-4 h-4 text-[#0f766e] border-slate-350 rounded focus:ring-[#0f766e] cursor-pointer"
              />
              <span className="text-xs uppercase font-bold tracking-wider text-slate-505">
                Select All {filteredMeds.length > 0 ? `(${filteredMeds.length})` : ''}
              </span>
            </div>
            
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-slate-600 font-bold text-xs bg-slate-205 px-2 py-0.5 rounded-md">
                  {selectedIds.length} Selected
                </span>
                <button
                  onClick={handleBatchDelete}
                  disabled={deleting}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm shadow-rose-700/10 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm font-bold">delete</span>
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-slate-500 hover:text-slate-805 text-xs font-bold px-2 py-2 cursor-pointer transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        )}

        {/* Medicine List Grid/List View */}
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : filteredMeds.length === 0 ? (
          <div className="text-center py-12 border border-slate-200 border-dashed rounded-xl bg-slate-50/50 p-8">
            <span className="material-symbols-outlined text-slate-300 text-4xl mb-2">medication</span>
            <p className="text-xs text-slate-400 italic">No {filter} medications found.</p>
          </div>
        ) : layout === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMeds.map((med) => {
              const isActive = med.status === 'active'
              const isChecked = selectedIds.includes(med.id)
              
              return (
                <div 
                  key={med.id} 
                  className={`border rounded-xl p-4 flex flex-col justify-between gap-3.5 hover:border-slate-400 transition-all shadow-sm relative ${
                    isChecked 
                      ? 'bg-teal-50/10 border-teal-350' 
                      : isActive 
                        ? 'bg-white border-slate-200/80' 
                        : 'bg-slate-50/70 border-slate-200/50 opacity-75'
                  }`}
                >
                  {/* Title and Checkbox */}
                  <div className="flex items-start gap-2.5 min-w-0">
                    <input 
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleSelectToggle(med.id)}
                      className="w-4 h-4 text-[#0f766e] border-slate-300 rounded focus:ring-[#0f766e] cursor-pointer mt-0.5 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-grow text-left cursor-pointer" onClick={() => setActiveModalMed(med)}>
                      <h4 className={`text-lg font-bold truncate hover:text-[#0f766e] transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`} title={med.brand_name || med.generic_name}>
                        {med.brand_name || med.generic_name}
                      </h4>
                      {med.brand_name && med.generic_name && med.brand_name.toLowerCase() !== med.generic_name.toLowerCase() && (
                        <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5" title={med.generic_name}>
                          {med.generic_name}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          isActive 
                            ? 'bg-teal-50 border border-teal-200 text-teal-800' 
                            : 'bg-slate-100 border border-slate-200 text-slate-500'
                        }`}>
                          {med.status}
                        </span>
                        <span className="text-[11px] text-[#0f766e] font-semibold hover:underline flex items-center gap-1 cursor-pointer">
                          <span className="material-symbols-outlined text-[13px]">visibility</span>
                          <span>View Rx</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info Block */}
                  <div className="space-y-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3 flex-grow text-left cursor-pointer" onClick={() => setActiveModalMed(med)}>
                    <p className="flex items-center gap-1.5 font-medium truncate">
                      <span className="material-symbols-outlined text-slate-400 text-[18px]">medication</span>
                      <span className="font-bold text-slate-700">Dosage:</span> {unescapeHTML(med.dosage || '')}
                    </p>
                    <p className="flex items-center gap-1.5 font-medium truncate">
                      <span className="material-symbols-outlined text-slate-400 text-[18px]">schedule</span>
                      <span className="font-bold text-slate-700">Frequency:</span> {unescapeHTML(med.frequency || '')}
                    </p>
                    {isActive ? (
                      <p className="flex items-center gap-1.5 font-medium truncate">
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">calendar_today</span>
                        <span className="font-bold text-slate-700">Since:</span> {new Date(med.added_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 font-medium truncate">
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">history</span>
                        <span className="font-bold text-slate-700">Ended:</span> {med.course_end_date ? new Date(med.course_end_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                      </p>
                    )}
                  </div>

                  {/* Actions Button */}
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-end">
                    {isActive ? (
                      <button 
                        onClick={() => toggleStatus(med.id, med.status)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full"
                      >
                        <span className="material-symbols-outlined text-[16px]">block</span>
                        Discontinue
                      </button>
                    ) : (
                      <button 
                        onClick={() => toggleStatus(med.id, med.status)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full"
                      >
                        <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredMeds.map((med) => {
              const isActive = med.status === 'active'
              const isChecked = selectedIds.includes(med.id)
              
              return (
                <div 
                  key={med.id} 
                  className={`border rounded-xl p-4 flex items-center justify-between gap-4 hover:border-slate-400 transition-all shadow-sm ${
                    isChecked 
                      ? 'bg-teal-50/10 border-teal-350' 
                      : isActive 
                        ? 'bg-white border-slate-200/80' 
                        : 'bg-slate-50/70 border-slate-200/50 opacity-75'
                  }`}
                >
                  {/* Row Checkbox & Info */}
                  <div className="flex items-center gap-3.5 flex-grow min-w-0">
                    <input 
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleSelectToggle(med.id)}
                      className="w-4 h-4 text-[#0f766e] border-slate-300 rounded focus:ring-[#0f766e] cursor-pointer flex-shrink-0"
                    />

                    <div className="flex-grow flex flex-col md:flex-row md:items-center gap-4 md:gap-8 min-w-0">
                      <div className="min-w-[180px] max-w-[240px] truncate text-left cursor-pointer" onClick={() => setActiveModalMed(med)}>
                        <h4 className={`text-base font-bold truncate hover:text-[#0f766e] transition-colors ${isActive ? 'text-[#0f766e]' : 'text-slate-400 line-through'}`} title={unescapeHTML(med.brand_name || med.generic_name || '')}>
                          {unescapeHTML(med.brand_name || med.generic_name || '')}
                        </h4>
                        {med.brand_name && med.generic_name && med.brand_name.toLowerCase() !== med.generic_name.toLowerCase() && (
                          <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5" title={unescapeHTML(med.generic_name || '')}>
                            {unescapeHTML(med.generic_name || '')}
                          </p>
                        )}
                        <span className={`inline-block mt-1.5 text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          isActive 
                            ? 'bg-teal-50 border border-teal-200 text-teal-800' 
                            : 'bg-slate-100 border border-slate-200 text-slate-500'
                        }`}>
                          {med.status}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-xs text-slate-500 cursor-pointer" onClick={() => setActiveModalMed(med)}>
                        <p className="flex items-center gap-1.5 font-medium">
                          <span className="material-symbols-outlined text-slate-400 text-[18px]">medication</span>
                          <span className="font-bold text-slate-700">Dosage:</span> {unescapeHTML(med.dosage || '')}
                        </p>
                        <p className="flex items-center gap-1.5 font-medium">
                          <span className="material-symbols-outlined text-slate-400 text-[18px]">schedule</span>
                          <span className="font-bold text-slate-700">Frequency:</span> {unescapeHTML(med.frequency || '')}
                        </p>
                        {isActive ? (
                          <p className="flex items-center gap-1.5 font-medium">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">calendar_today</span>
                            <span className="font-bold text-slate-700">Since:</span> {new Date(med.added_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        ) : (
                          <p className="flex items-center gap-1.5 font-medium">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">history</span>
                            <span className="font-bold text-slate-700">Ended:</span> {med.course_end_date ? new Date(med.course_end_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center justify-end md:border-l md:border-slate-100 md:pl-4">
                    {isActive ? (
                      <button 
                        onClick={() => toggleStatus(med.id, med.status)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full md:w-auto"
                      >
                        <span className="material-symbols-outlined text-[16px]">block</span>
                        Discontinue
                      </button>
                    ) : (
                      <button 
                        onClick={() => toggleStatus(med.id, med.status)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full md:w-auto"
                      >
                        <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Global Prescription Source Modal Popup */}
        <PrescriptionSourceModal
          medicine={activeModalMed}
          onClose={() => setActiveModalMed(null)}
        />
      </main>

      {/* Footer */}
      <footer className="bg-[#f6fafa] border-t border-slate-200 mt-auto">
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
