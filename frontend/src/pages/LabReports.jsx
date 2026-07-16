import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'

export default function LabReports() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [activeReportId, setActiveReportId] = useState(null)
  const [activeReportDetails, setActiveReportDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState('')

  // Map to hold historical values for trend calculations
  const [testHistory, setTestHistory] = useState({})

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    fetchLabReports()
  }, [user])

  const fetchLabReports = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/lab-reports', { params: { patient_id: user.id } })
      const reportsList = res.data.data
      setReports(reportsList)
      
      // If there are reports, pre-load details for the first one
      if (reportsList.length > 0) {
        handleSelectReport(reportsList[0].id)
      }
      
      // Build history map across all reports to calculate trends
      await buildHistoricalMap(reportsList)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch lab reports.')
    } finally {
      setLoading(false)
    }
  }

  const buildHistoricalMap = async (reportsList) => {
    try {
      const historyMap = {}
      // Fetch details for all reports to gather historical test values
      const detailsPromises = reportsList.map(r => api.get(`/lab-reports/${r.id}`))
      const responses = await Promise.all(detailsPromises)
      
      responses.forEach(res => {
        const report = res.data.data
        const date = report.uploaded_at || report.created_at
        if (report.values && Array.isArray(report.values)) {
          report.values.forEach(val => {
            const key = val.test_type.trim().toUpperCase()
            if (!historyMap[key]) {
              historyMap[key] = []
            }
            historyMap[key].push({
              value: parseFloat(val.value),
              unit: val.unit,
              date: new Date(date)
            })
          })
        }
      })

      // Sort history items by date ascending for sequential trend analysis
      Object.keys(historyMap).forEach(key => {
        historyMap[key].sort((a, b) => a.date - b.date)
      })

      setTestHistory(historyMap)
    } catch (err) {
      console.warn('Failed to build test history map:', err)
    }
  }

  const handleSelectReport = async (reportId) => {
    setActiveReportId(reportId)
    setDetailsLoading(true)
    try {
      const res = await api.get(`/lab-reports/${reportId}`)
      setActiveReportDetails(res.data.data)
    } catch (err) {
      setError('Failed to load lab report details.')
    } finally {
      setDetailsLoading(false)
    }
  }

  // Calculate trends for a specific test type compared to past values
  const getTrendDescriptor = (testType, currentValue) => {
    const key = testType.trim().toUpperCase()
    const history = testHistory[key] || []
    if (history.length < 2) return null

    // Find index of current value in history (matching by value & date proximity)
    const idx = history.findIndex(h => h.value === parseFloat(currentValue))
    if (idx <= 0) return null // No previous value to compare to

    const prev = history[idx - 1]
    const currentVal = parseFloat(currentValue)
    const diff = currentVal - prev.value
    const pct = ((diff / prev.value) * 100).toFixed(1)

    if (diff > 0) {
      return {
        direction: 'up',
        color: 'text-amber-600 bg-amber-50 border border-amber-200',
        icon: 'trending_up',
        text: `Increased by ${pct}% (previous: ${prev.value} ${prev.unit})`
      }
    } else if (diff < 0) {
      return {
        direction: 'down',
        color: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
        icon: 'trending_down',
        text: `Decreased by ${Math.abs(pct)}% (previous: ${prev.value} ${prev.unit})`
      }
    }
    return {
      direction: 'stable',
      color: 'text-slate-600 bg-slate-50 border border-slate-200',
      icon: 'trending_flat',
      text: 'Stable'
    }
  }

  return (
    <>
      <main className="flex-grow w-full px-6 md:px-16 max-w-[1200px] mx-auto py-12 animate-fade-in">
        
        {/* Header Section */}
        <div className="mb-12 text-left">
          <h1 className="font-sans text-5xl font-bold text-slate-900 mb-4">Lab Reports</h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Track and monitor clinical laboratory test measurements, reference values, and medical trends.
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-left">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            <div className="lg:col-span-4 space-y-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
            <div className="lg:col-span-8">
              <Skeleton className="h-[400px] w-full rounded-xl" />
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-left py-16 border border-slate-200 border-dashed rounded-xl bg-white p-8">
            <p className="text-sm text-slate-500 mb-4">No lab reports found.</p>
            <Link 
              to="/upload" 
              className="bg-[#0f766e] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#0d645e] transition-colors"
            >
              Upload New Report
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            
            {/* Left: Reports list panel */}
            <div className="lg:col-span-4 space-y-4 overflow-y-auto max-h-[600px] pr-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reports History</h3>
              {reports.map((report) => {
                const isActive = report.id === activeReportId;
                const formattedDate = new Date(report.uploaded_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                return (
                  <div
                    key={report.id}
                    onClick={() => handleSelectReport(report.id)}
                    className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'bg-teal-50/20 border-[#0f766e] shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-800 text-sm">Lab Report</h4>
                      <span className="text-[10px] text-slate-400 font-semibold">{formattedDate}</span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-slate-400">person_play</span>
                      Doctor: {report.doctor_name || 'Generic Provider'}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Right: Detailed View */}
            <div className="lg:col-span-8">
              {detailsLoading ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
                  <Skeleton className="h-8 w-48 mb-6" />
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ) : activeReportDetails ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm flex flex-col min-h-[450px]">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                    <div>
                      <h3 className="font-sans text-2xl font-bold text-slate-900">Lab Values</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Recorded on: {new Date(activeReportDetails.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    {activeReportDetails.doctor_name && (
                      <span className="bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Dr. {activeReportDetails.doctor_name}
                      </span>
                    )}
                  </div>

                  <div className="space-y-6 flex-grow">
                    {activeReportDetails.values && activeReportDetails.values.length > 0 ? (
                      activeReportDetails.values.map((val) => {
                        const trend = getTrendDescriptor(val.test_type, val.value);
                        return (
                          <div 
                            key={val.id} 
                            className="border border-slate-100 bg-slate-50/50 rounded-xl p-5 hover:border-slate-200 transition-colors"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-bold text-slate-800 text-lg">{val.test_type}</h4>
                                {val.panel_name && (
                                  <span className="text-[10px] text-slate-400 font-semibold bg-white border border-slate-200/50 px-2 py-0.5 rounded">
                                    {val.panel_name}
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="font-sans text-2xl font-extrabold text-[#0f766e]">
                                  {val.value} <span className="text-sm font-semibold text-slate-500">{val.unit}</span>
                                </span>
                              </div>
                            </div>

                            {trend && (
                              <div className={`mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${trend.color}`}>
                                <span className="material-symbols-outlined text-sm">{trend.icon}</span>
                                <span>{trend.text}</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-400 italic">No lab values extracted for this report.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm flex items-center justify-center min-h-[450px]">
                  <p className="text-sm text-slate-400 italic">Select a report to view details.</p>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

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
