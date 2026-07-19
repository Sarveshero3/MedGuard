import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'

export default function Calendar() {
  const { user, loading: authLoading, activePatientId } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  const [appointments, setAppointments] = useState([])
  const [courseEnds, setCourseEnds] = useState([])
  const [activeMedicines, setActiveMedicines] = useState([])
  const [adherenceLogs, setAdherenceLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Date State for Monthly Grid
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())

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
    if (!user) return
    if (user.role === 'caregiver' && !activePatientId) {
      setLoading(false)
      setBriefsLoading(false)
      return
    }
    fetchCalendarData()
    fetchBriefs()
  }, [user, activePatientId])

  const fetchBriefs = async () => {
    setBriefsLoading(true)
    try {
      const res = await api.get('/briefs', { params: { patient_id: activePatientId } })
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
      const [calRes, adhRes] = await Promise.all([
        api.get('/calendar', { params: { patient_id: activePatientId } }),
        api.get('/adherence', { params: { patient_id: activePatientId } }).catch(() => ({ data: { data: [] } }))
      ])
      
      setAppointments(calRes.data.data?.visits || [])
      setCourseEnds(calRes.data.data?.course_ends || [])
      setActiveMedicines(calRes.data.data?.medicines || [])
      setAdherenceLogs(adhRes.data.data || [])
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch calendar data')
    } finally {
      setLoading(false)
    }
  }

  const handleAdherenceToggle = async (medicineId, dateStr, currentStatus) => {
    const newStatus = currentStatus === 'taken' ? 'missed' : 'taken'
    try {
      await api.post('/adherence', {
        patient_id: activePatientId,
        medicine_id: medicineId,
        scheduled_date: dateStr,
        status: newStatus
      })
      fetchCalendarData()
    } catch (err) {
      console.error('Failed to log adherence', err)
    }
  }

  const handleBookAppointment = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/appointments', {
        patient_id: activePatientId,
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


  // --- Calendar Math ---
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  const startDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday, 6 = Saturday
  const daysInMonth = lastDayOfMonth.getDate()

  const daysGrid = []
  
  // Padding cells before the 1st of the month
  for (let i = 0; i < startDayOfWeek; i++) {
    daysGrid.push(null)
  }
  
  // Real day cells
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push(new Date(year, month, d))
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1))
  }

  const isToday = (date) => {
    if (!date) return false
    const today = new Date()
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
  }

  const isSelected = (date) => {
    if (!date) return false
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
  }

  // Check if a medicine is active on a given date
  const isMedicineActiveOnDate = (med, date) => {
    if (!med.added_at) return false
    const start = new Date(med.added_at)
    start.setHours(0, 0, 0, 0)
    
    const current = new Date(date)
    current.setHours(0, 0, 0, 0)
    
    if (current < start) return false
    
    if (med.course_end_date) {
      const end = new Date(med.course_end_date)
      end.setHours(23, 59, 59, 999)
      if (current > end) return false
    }
    
    return med.status === 'active' || med.status === undefined
  }

  // Sort and assign tracks to active medicines to prevent overlapping lines
  // Exclude lifetime medicines from calendar bar/legend rendering
  const sortedMedicines = [...activeMedicines].filter(med => !med.is_lifetime).sort((a, b) => new Date(a.added_at) - new Date(b.added_at))

  // Filter items for a specific date cell
  const getDayAppointments = (date) => {
    if (!date) return []
    return appointments.filter(v => {
      const vDate = new Date(v.scheduled_date)
      return vDate.getDate() === date.getDate() &&
        vDate.getMonth() === date.getMonth() &&
        vDate.getFullYear() === date.getFullYear()
    })
  }

  // Active medicines for the selected day checklist
  const selectedDateStr = selectedDate.toISOString().split('T')[0]
  const selectedDayMeds = activeMedicines.filter(med => isMedicineActiveOnDate(med, selectedDate))
  const selectedDayLogs = adherenceLogs.filter(log => log.scheduled_date.startsWith(selectedDateStr))

  const getSpecialtyColor = (type) => {
    if (type === 'cardiology') return 'bg-rose-50 text-rose-750 border border-rose-100 hover:bg-rose-100/50'
    if (type === 'neurology') return 'bg-purple-50 text-purple-750 border border-purple-100 hover:bg-purple-100/50'
    if (type === 'orthopedics') return 'bg-amber-50 text-amber-755 border border-amber-100 hover:bg-amber-100/50'
    if (type === 'pediatrics') return 'bg-blue-50 text-blue-750 border border-blue-100 hover:bg-blue-100/50'
    return 'bg-teal-50 text-teal-750 border border-teal-100 hover:bg-teal-100/50'
  }

  const getSpecialtyIcon = (type) => {
    if (type === 'cardiology') return 'favorite'
    if (type === 'neurology') return 'psychology'
    if (type === 'orthopedics') return 'bone'
    if (type === 'pediatrics') return 'child_care'
    return 'medical_services'
  }

  // Configured list of soft colors for medicine visual spans (Google/Period Tracker style)
  const trackColors = [
    'bg-teal-100/80 text-teal-900 border-y border-teal-200/50',
    'bg-purple-100/80 text-purple-900 border-y border-purple-200/50',
    'bg-amber-100/80 text-amber-900 border-y border-amber-200/50',
    'bg-rose-100/80 text-[#881337] border-y border-rose-200/50',
    'bg-sky-100/80 text-sky-900 border-y border-sky-200/50',
  ]

  return (
    <>
      {/* Main Content Area */}
      <main className="flex-grow px-4 md:px-12 py-8 max-w-[1400px] mx-auto w-full animate-fade-in">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 text-left">
          <div>
            <h1 className="font-sans text-4xl font-bold text-slate-900 mb-2">Health Calendar</h1>
            <p className="text-sm text-slate-505 max-w-2xl font-medium">
              Track appointments, visualize medicine courses, and log daily medication adherence.
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
            {/* Schedule Appointment Button */}
            <button 
              onClick={() => {
                // Pre-populate scheduled date with selected date if form is shown
                const localDateTime = new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000)
                  .toISOString().slice(0, 16);
                setFormData(prev => ({ ...prev, scheduled_date: localDateTime }))
                setShowForm(!showForm)
              }}
              className="bg-[#0F766E] hover:bg-[#0d645c] text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all flex items-center shadow-sm cursor-pointer shadow-teal-700/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined mr-1.5 text-[18px]">add</span>
              Schedule Appointment
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs text-left font-semibold animate-fade-in flex items-center gap-2">
            <span className="material-symbols-outlined text-sm font-bold">error</span>
            {error}
          </div>
        )}

        {/* Appointment Booking Form Modal */}
        {showForm && (
          <div className="mb-8 bg-white border border-slate-200 rounded-2xl p-6 md:p-8 text-left shadow-md max-w-2xl mx-auto animate-fade-in">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#0F766E]">edit_calendar</span>
              New Appointment
            </h3>
            
            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="doctor_name" className="text-xs font-bold text-slate-550 uppercase tracking-wider">Doctor's Name</label>
                  <input
                    id="doctor_name"
                    type="text"
                    required
                    placeholder="Dr. Sarah Jenkins"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F766E] bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    value={formData.doctor_name}
                    onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="visit_type" className="text-xs font-bold text-slate-555 uppercase tracking-wider">Specialty / Clinic</label>
                  <select
                    id="visit_type"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F766E] bg-slate-50/50 hover:bg-slate-50 transition-colors"
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

              <div className="flex flex-col gap-1.5">
                <label htmlFor="scheduled_date" className="text-xs font-bold text-slate-550 uppercase tracking-wider">Date &amp; Time</label>
                <input
                  id="scheduled_date"
                  type="datetime-local"
                  required
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F766E] bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="notes" className="text-xs font-bold text-slate-550 uppercase tracking-wider">Notes / Instructions</label>
                <textarea
                  id="notes"
                  rows={2}
                  placeholder="Fasting required 12 hours prior, bring prescription records..."
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F766E] bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-transparent hover:bg-slate-50 text-slate-500 hover:text-slate-900 font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0F766E] hover:bg-[#0d645c] text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm shadow-teal-700/5 hover:scale-[1.02]"
                >
                  Create Appointment
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Calendar Workspace Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* Left Area: Visual Monthly Calendar Grid (Span 8) */}
          <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 md:p-8 shadow-sm text-left">
            
            {/* Calendar Controller Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 capitalize">
                <span className="material-symbols-outlined text-[#0F766E]">calendar_month</span>
                {currentMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handlePrevMonth}
                  className="p-2 border border-slate-200 hover:border-slate-350 rounded-xl bg-white hover:bg-slate-50 text-slate-650 transition-all cursor-pointer"
                  title="Previous month"
                >
                  <span className="material-symbols-outlined text-lg block">chevron_left</span>
                </button>
                <button 
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-2 border border-slate-200 hover:border-slate-350 rounded-xl bg-white hover:bg-slate-50 text-xs font-bold text-slate-650 transition-all cursor-pointer"
                >
                  Today
                </button>
                <button 
                  onClick={handleNextMonth}
                  className="p-2 border border-slate-200 hover:border-slate-350 rounded-xl bg-white hover:bg-slate-50 text-slate-650 transition-all cursor-pointer"
                  title="Next month"
                >
                  <span className="material-symbols-outlined text-lg block">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Weekdays Labels */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Days Grid */}
            {loading ? (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {daysGrid.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="h-28 bg-slate-50/30 border border-slate-100 rounded-xl opacity-30"></div>
                  }

                  const dayAppts = getDayAppointments(date)
                  const dayIsToday = isToday(date)
                  const dayIsSelected = isSelected(date)

                  return (
                    <div 
                      key={date.toISOString()}
                      onClick={() => setSelectedDate(date)}
                      className={`h-28 border rounded-xl p-1.5 flex flex-col justify-between cursor-pointer transition-all duration-155 text-left relative overflow-hidden select-none hover:shadow-sm ${
                        dayIsSelected 
                          ? 'border-[#0F766E] ring-1 ring-[#0F766E] bg-teal-50/5' 
                          : dayIsToday
                            ? 'border-teal-350 bg-teal-50/15'
                            : 'border-slate-200 hover:border-slate-350 bg-white'
                      }`}
                    >
                      {/* Day Number Row */}
                      <div className="flex justify-between items-center w-full">
                        <span className={`text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                          dayIsToday 
                            ? 'bg-[#0F766E] text-white font-black' 
                            : dayIsSelected
                              ? 'text-[#0F766E] bg-teal-100/50'
                              : 'text-slate-650'
                        }`}>
                          {date.getDate()}
                        </span>
                        
                        {/* Tiny appointment notification badge */}
                        {dayAppts.length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 animate-pulse"></span>
                        )}
                      </div>

                      {/* Visual Multi-Day Medicine Tracks (Gantt/Period Tracker flow) */}
                      <div className="flex flex-col gap-0.5 w-full flex-grow mt-1.5 overflow-hidden">
                        {sortedMedicines.slice(0, 3).map((med, trackIdx) => {
                          const isActive = isMedicineActiveOnDate(med, date)
                          
                          if (!isActive) {
                            return <div key={med.id} className="h-[14px] bg-transparent"></div>
                          }

                          // Calculate edges for periods continuous flow
                          const isStart = new Date(med.added_at).toDateString() === date.toDateString()
                          const isEnd = med.course_end_date && new Date(med.course_end_date).toDateString() === date.toDateString()
                          const isSunday = date.getDay() === 0
                          const isSaturday = date.getDay() === 6

                          return (
                            <div 
                              key={med.id}
                              className={`h-[14px] text-[8px] font-bold px-1 py-0 flex items-center overflow-hidden truncate transition-all leading-none ${
                                trackColors[trackIdx % trackColors.length]
                              } ${
                                isStart || isSunday ? 'rounded-l-md border-l border-current/25 pl-1.5' : 'border-l-0 pl-0.5'
                              } ${
                                isEnd || isSaturday ? 'rounded-r-md border-r border-current/25 pr-1.5' : 'border-r-0 pr-0.5'
                              }`}
                              title={`${med.brand_name || med.generic_name} (${med.dosage})`}
                            >
                              {(isStart || isSunday) ? (med.brand_name || med.generic_name) : ''}
                            </div>
                          )
                        })}
                      </div>

                      {/* Bottom row displaying Doctor Consults if any */}
                      {dayAppts.length > 0 && (
                        <div className="text-[7.5px] font-extrabold text-[#0F766E] uppercase tracking-wider flex items-center gap-0.5 pl-0.5 pb-0.5">
                          <span className="material-symbols-outlined text-[9px] font-bold">medical_services</span>
                          Dr. {dayAppts[0].doctor_name?.split(' ').slice(-1)[0] || 'Consult'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Visual Medicine Color Code Legend */}
            {sortedMedicines.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-2 flex items-center">Active Course Spans:</span>
                {sortedMedicines.slice(0, 5).map((med, idx) => (
                  <div key={med.id} className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-md ${trackColors[idx % trackColors.length].split(' ')[0]} border border-current/20`}></span>
                    <span>{med.brand_name || med.generic_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Right Area: Selected Day Adherence Checklist + Appointments Detail (Span 4) */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Daily Adherence Checklist Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-left shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#0F766E]">task_alt</span>
                  Medication Log
                </h3>
                <span className="text-xs font-bold text-[#0F766E] bg-teal-50 px-2 py-0.5 rounded-md">
                  {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
              
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : selectedDayMeds.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic text-xs border border-dashed border-slate-150 rounded-xl bg-slate-50/50 p-4">
                  No medication courses scheduled for this date.
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const todayLocal = new Date()
                    todayLocal.setHours(0, 0, 0, 0)
                    const selLocal = new Date(selectedDate)
                    selLocal.setHours(0, 0, 0, 0)
                    const isFuture = selLocal > todayLocal

                    return selectedDayMeds.map(med => {
                      const log = selectedDayLogs.find(l => l.medicine_id === med.id)
                      const isTaken = log?.status === 'taken'
                    
                      return (
                        <div 
                          key={med.id} 
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                            isFuture ? 'opacity-60 cursor-not-allowed' : ''
                          } ${
                            isTaken 
                              ? 'bg-emerald-50/40 border-emerald-100' 
                              : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => handleAdherenceToggle(med.id, selectedDateStr, log?.status)}
                              disabled={isFuture}
                              className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                                isFuture
                                  ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                                  : isTaken 
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm cursor-pointer' 
                                    : 'bg-white border-slate-350 text-transparent hover:border-[#0F766E] cursor-pointer'
                              }`}
                            >
                              {isTaken && (
                                <span className="material-symbols-outlined text-[15px] font-bold">check</span>
                              )}
                            </button>
                            <div>
                              <div className="font-bold text-slate-800 text-sm truncate max-w-[150px]" title={med.brand_name || med.generic_name}>
                                {med.brand_name || med.generic_name}
                              </div>
                              <div className="text-xs text-slate-500 font-medium">
                                {med.dosage} • {med.frequency}
                              </div>
                            </div>
                          </div>
                          {isFuture ? (
                            <span className="text-[10px] font-semibold text-slate-400 italic">
                              Scheduled
                            </span>
                          ) : isTaken ? (
                            <span className="text-[10px] font-bold text-emerald-805 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              Taken
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400">
                              Pending
                            </span>
                          )}
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>

            {/* Selected Day Appointments Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-left shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#0F766E]">stethoscope</span>
                Appointments &amp; Milestones
              </h3>
              
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : (
                (() => {
                  const dayAppts = getDayAppointments(selectedDate)
                  const dayEnds = courseEnds.filter(c => {
                    const cDate = new Date(c.course_end_date)
                    return cDate.getDate() === selectedDate.getDate() &&
                      cDate.getMonth() === selectedDate.getMonth() &&
                      cDate.getFullYear() === selectedDate.getFullYear()
                  })

                  if (dayAppts.length === 0 && dayEnds.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-400 italic text-xs border border-dashed border-slate-150 rounded-xl bg-slate-50/50 p-4">
                        No appointments or course ends on this date.
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-4">
                      {/* Show Appointments */}
                      {dayAppts.map(appt => (
                        <div 
                          key={appt.id}
                          className={`border rounded-xl p-4 transition-all relative overflow-hidden bg-white shadow-sm hover:border-[#0F766E]`}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${
                            appt.visit_type === 'cardiology' ? 'bg-rose-500' :
                            appt.visit_type === 'neurology' ? 'bg-purple-500' :
                            appt.visit_type === 'orthopedics' ? 'bg-amber-500' : 'bg-[#0F766E]'
                          }`}></div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {new Date(appt.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase ${getSpecialtyColor(appt.visit_type)}`}>
                              {appt.visit_type}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-800 mb-1">
                            Dr. {appt.doctor_name || 'Clinician'}
                          </h4>
                          {appt.notes && (
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                              {appt.notes}
                            </p>
                          )}
                        </div>
                      ))}

                      {/* Show Course Ends */}
                      {dayEnds.map(end => (
                        <div 
                          key={end.id}
                          className="border border-amber-100 rounded-xl p-4 bg-amber-50/20 relative overflow-hidden shadow-sm"
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-amber-400"></div>
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                              Course End
                            </span>
                            <span className="material-symbols-outlined text-amber-500 text-base font-bold animate-pulse">medication</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 mb-0.5">
                            {end.brand_name} (Course Complete)
                          </h4>
                          <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                            Check clinical indicators or consult with your physician before refilling.
                          </p>
                        </div>
                      ))}
                    </div>
                  )
                })()
              )}
            </div>

            {/* Recent Briefs Link */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-left shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#0F766E]">article</span>
                Clinician Prep Briefs
              </h3>
              
              {briefsLoading ? (
                <Skeleton className="h-16 w-full rounded-xl" />
              ) : briefs.length === 0 ? (
                <div className="text-center py-6 text-slate-400 italic text-xs border border-dashed border-slate-150 rounded-xl bg-slate-50/50 p-4">
                  No briefs created yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {briefs.slice(0, 2).map(brief => (
                    <div key={brief.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 flex justify-between items-center">
                      <div className="truncate max-w-[150px]">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">For Date: {brief.content?.for_date || 'N/A'}</span>
                        <span className="text-xs font-bold text-slate-700 block truncate">{brief.content?.summary || 'Prep Brief'}</span>
                      </div>
                      <Link to={`/brief/${brief.id}`} className="text-[10px] font-bold text-teal-700 hover:text-teal-900 border border-teal-200 hover:border-teal-400 bg-white px-2 py-1 rounded-md transition-all">
                        View Brief
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#f6fafa] border-t border-slate-200 mt-16">
        <div className="w-full py-12 px-6 md:px-16 flex flex-col md:flex-row justify-between items-center gap-4 max-w-[1400px] mx-auto text-sm text-slate-500">
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
