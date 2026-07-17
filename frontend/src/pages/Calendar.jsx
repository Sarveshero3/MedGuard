import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'
import { MgNavbar } from '../components/MgNavbar'

export default function Calendar() {
  const { user, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])
  const [timelineItems, setTimelineItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Appointment Form State
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    doctor_name: '',
    visit_type: 'general',
    scheduled_date: '',
    notes: '',
  })

  // Briefs State
  const [briefs, setBriefs] = useState([])
  const [briefsLoading, setBriefsLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    fetchCalendarData()
    fetchBriefs()
  }, [user?.id])

  const fetchBriefs = async () => {
    setBriefsLoading(true)
    try {
      const res = await api.get('/briefs', { params: { patient_id: user.id } })
      setBriefs(res.data.data || [])
    } catch (err) {
      console.error('Failed to fetch briefs', err)
    } finally {
      setBriefsLoading(false)
    }
  }

  const fetchCalendarData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/calendar', { params: { patient_id: user.id } })
      const appointments = (res.data.data?.visits || []).map(v => ({
        ...v,
        type: 'appointment',
        sortDate: new Date(v.scheduled_date),
      }))
      const courseEnds = (res.data.data?.course_ends || []).map(c => ({
        ...c,
        type: 'course_end',
        sortDate: new Date(c.course_end_date),
      }))

      const merged = [...appointments, ...courseEnds].sort((a, b) => a.sortDate - b.sortDate)
      setTimelineItems(merged)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch calendar timeline')
    } finally {
      setLoading(false)
    }
  }

  const handleBookAppointment = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/appointments', {
        patient_id: user.id,
        doctor_name: formData.doctor_name,
        visit_type: formData.visit_type,
        scheduled_date: formData.scheduled_date,
        notes: formData.notes,
      })
      
      setShowForm(false)
      setFormData({ doctor_name: '', visit_type: 'general', scheduled_date: '', notes: '' })
      fetchCalendarData()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to book appointment')
    }
  }

  const getTimelineIcon = (item) => {
    if (item.type === 'course_end') return 'medication'
    if (item.visit_type === 'cardiology') return 'stethoscope'
    if (item.visit_type === 'orthopedics') return 'bone'
    if (item.visit_type === 'neurology') return 'psychology'
    return 'medical_services'
  }

  return (
    <>
      {/* Main Content Area */}
      <main className="flex-grow px-6 md:px-16 py-12 max-w-[1200px] mx-auto w-full animate-fade-in">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 text-left">
          <div>
            <h1 className="font-sans text-5xl font-bold text-slate-900 mb-2">Health Timeline</h1>
            <p className="text-sm text-slate-500 max-w-2xl">
              A chronological record of your upcoming clinical appointments and medication milestones.
            </p>
          </div>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="mt-6 md:mt-0 bg-[#0F766E] text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-accent-hover transition-colors flex items-center shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined mr-2 text-[20px]">add</span>
            Add Appointment
          </button>
        </header>

        {error && (
          <div className="error-banner mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-left">
            {error}
          </div>
        )}

        {/* Appointment Booking Form Dropdown */}
        {showForm && (
          <div className="mb-12 bg-white border border-slate-200 rounded-xl p-8 text-left shadow-sm max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Schedule New Appointment</h3>
            
            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="doctor_name">Doctor's Name</label>
                  <input
                    id="doctor_name"
                    type="text"
                    required
                    placeholder="Dr. Sarah Jenkins"
                    value={formData.doctor_name}
                    onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="visit_type">Specialty</label>
                  <select
                    id="visit_type"
                    value={formData.visit_type}
                    onChange={(e) => setFormData({ ...formData, visit_type: e.target.value })}
                  >
                    <option value="general">General Medicine</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="neurology">Neurology</option>
                    <option value="orthopedics">Orthopedics</option>
                    <option value="pediatrics">Pediatrics</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="scheduled_date">Appointment Date &amp; Time</label>
                <input
                  id="scheduled_date"
                  type="datetime-local"
                  required
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes / Instructions</label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Fasting required 12 hours prior, bring prescription records..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-transparent text-slate-500 hover:text-slate-900 font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0F766E] hover:bg-accent-hover text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Book Appointment
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Grid containing Timeline and Briefs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Timeline Container */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 md:p-12 relative overflow-hidden text-left shadow-sm">
            {loading ? (
              <div className="space-y-6">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ) : timelineItems.length === 0 ? (
              <p className="text-sm text-slate-500">No events or appointments scheduled.</p>
            ) : (
              <div className="relative">
                {timelineItems.map((item, index) => {
                  const isAppt = item.type === 'appointment'
                  return (
                    <div key={item.id || index} className="relative flex items-start mb-12 last:mb-0 group">
                      
                      {/* Vertical connecting line */}
                      {index < timelineItems.length - 1 && (
                        <div className="absolute left-[23px] top-[48px] bottom-[-48px] w-0.5 bg-slate-200 z-0"></div>
                      )}

                      {/* Circle Node icon */}
                      <div className="flex-shrink-0 flex flex-col items-center mr-8 z-10 w-12">
                        <div className={`w-12 h-12 rounded-full border bg-white flex items-center justify-center transition-all duration-300 ${
                          isAppt 
                            ? 'border-[#0F766E] text-[#0F766E] group-hover:bg-[#f0f9f8]' 
                            : 'border-slate-300 text-slate-400 group-hover:bg-slate-100'
                        }`}>
                          <span className="material-symbols-outlined text-xl">
                            {getTimelineIcon(item)}
                          </span>
                        </div>
                      </div>

                      {/* Content Card */}
                      <div className={`flex-grow border border-slate-200/80 rounded-xl p-6 transition-all duration-300 relative bg-white shadow-sm ${
                        isAppt ? 'hover:border-[#0F766E]' : 'hover:border-slate-400'
                      }`}>
                        {/* Left border indicator cue */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg opacity-80 ${
                          isAppt ? 'bg-[#0F766E]' : 'bg-slate-300'
                        }`}></div>

                        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {new Date(item.sortDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                {isAppt && ` • ${new Date(item.sortDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                                isAppt ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {isAppt ? 'Appointment' : 'Medicine Course End'}
                              </span>
                            </div>
                            
                            <h3 className="text-2xl font-bold text-slate-900 mb-1">
                              {isAppt 
                                ? (item.visit_type ? `${item.visit_type.toUpperCase()} Consult` : 'General Consult') 
                                : `${item.brand_name} Course End`
                              }
                            </h3>
                            <p className="text-sm text-slate-500">
                              {isAppt 
                                ? `Dr. ${item.doctor_name || 'Clinician'}${item.notes ? ` • ${item.notes}` : ''}` 
                                : `Check clinical panel or consult physician before refill.`
                              }
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button className="text-slate-400 hover:text-[#0F766E] p-2 transition-colors border border-transparent hover:border-slate-100 rounded-lg cursor-pointer">
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button className="text-slate-400 hover:text-[#0F766E] p-2 transition-colors border border-transparent hover:border-slate-100 rounded-lg cursor-pointer">
                              <span className="material-symbols-outlined text-lg">more_vert</span>
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent Briefs Container */}
          <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 relative overflow-hidden text-left shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-650">article</span>
              Recent Briefs
            </h2>
            
            {briefsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : briefs.length === 0 ? (
              <div className="text-center py-10 border border-slate-100 border-dashed rounded-xl bg-slate-50/50 p-4">
                <p className="text-xs text-slate-400 mb-4">No doctor prep briefs found.</p>
                <Link 
                  to="/brief/new" 
                  className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-wider"
                >
                  Create Brief
                  <span className="material-symbols-outlined text-xs ml-1 font-bold">arrow_forward</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {briefs.map((brief) => {
                  const forDate = brief.content?.for_date || new Date(brief.generated_at).toISOString().split('T')[0]
                  const excerpt = brief.content?.summary 
                    ? (brief.content.summary.length > 80 ? brief.content.summary.substring(0, 80) + '...' : brief.content.summary)
                    : 'No summary available.'

                  return (
                    <div 
                      key={brief.id}
                      className="border border-slate-100 rounded-xl p-5 bg-slate-50/50 hover:bg-slate-50 transition-colors relative group"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          For: {forDate}
                        </span>
                        <Link 
                          to={`/brief/${brief.id}`}
                          className="text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          Edit Brief
                        </Link>
                      </div>
                      
                      <h4 className="text-sm font-bold text-slate-800 mb-1">
                        Prep Brief
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {excerpt}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

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
