import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'

export default function WriteBrief() {
  const { user, loading: authLoading } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [briefId, setBriefId] = useState(null)
  const [briefContent, setBriefContent] = useState({
    summary: '',
    changes_since_last_visit: '',
    questions: [],
    disclaimer: 'Discuss this with your doctor — this is not a diagnosis.',
    notes: '',
    for_date: ''
  })
  
  const [newQuestion, setNewQuestion] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    
    if (id) {
      // Load existing brief
      fetchBrief(id)
    } else {
      // Generate new brief
      generateBrief()
    }
  }, [user, id])

  const fetchBrief = async (briefUuid) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/briefs/${briefUuid}`)
      setBriefId(res.data.data.id)
      const content = res.data.data.content
      setBriefContent({
        summary: content.summary || '',
        changes_since_last_visit: content.changes_since_last_visit || '',
        questions: content.questions || [],
        disclaimer: content.disclaimer || 'Discuss this with your doctor — this is not a diagnosis.',
        notes: content.notes || '',
        for_date: content.for_date || new Date(res.data.data.generated_at).toISOString().split('T')[0]
      })
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load brief.')
    } finally {
      setLoading(false)
    }
  }

  const generateBrief = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/briefs', { patient_id: user.id })
      setBriefId(res.data.data.id)
      const content = res.data.data.content
      setBriefContent({
        summary: content.summary || '',
        changes_since_last_visit: content.changes_since_last_visit || '',
        questions: content.questions || [],
        disclaimer: content.disclaimer || 'Discuss this with your doctor — this is not a diagnosis.',
        notes: content.notes || '',
        for_date: content.for_date || new Date().toISOString().split('T')[0]
      })
      navigate(`/brief/${res.data.data.id}`, { replace: true })
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to generate visit brief. Check that you have active medicines.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddQuestion = (e) => {
    e.preventDefault()
    if (!newQuestion.trim()) return
    setBriefContent(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion.trim()]
    }))
    setNewQuestion('')
  }

  const handleRemoveQuestion = (idx) => {
    setBriefContent(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx)
    }))
  }

  const handleSave = async () => {
    if (!briefId) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.put(`/briefs/${briefId}`, {
        content: briefContent
      })
      setSuccess('✔ Visit brief saved successfully!')
      setTimeout(() => {
        navigate('/calendar')
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save brief.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="flex-grow w-full max-w-[800px] mx-auto px-6 py-16 text-left flex flex-col justify-center min-h-[400px]">
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-650 animate-spin"></div>
          <h2 className="text-xl font-bold text-slate-800 animate-pulse">Compiling Visit Preparation Brief...</h2>
          <p className="text-xs text-slate-500 max-w-sm">
            Retrieving active medications, checking drug-to-lab safety rules, and structuring discussion guidelines.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-grow w-full max-w-[800px] mx-auto px-6 py-12 text-left animate-fade-in">
      
      {/* Back to Dashboard */}
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider mb-8">
        <span className="material-symbols-outlined text-sm font-bold">arrow_back</span>
        Dashboard
      </Link>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-sans text-4xl font-bold text-slate-900 mb-2">Visit Preparation Brief</h1>
          <p className="text-xs text-slate-500">
            For appointment date: <strong>{briefContent.for_date}</strong>
          </p>
        </div>
        <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-md">
          Visit Summary
        </span>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-semibold">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg font-semibold">
          {success}
        </div>
      )}

      <div className="space-y-6">
        
        {/* Regimen Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-indigo-600 text-sm">clinical_notes</span>
            Active Regimen Summary
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/50 p-4 rounded-lg border border-slate-100">
            {briefContent.summary || 'No summary available.'}
          </p>
        </div>

        {/* Changes since last visit */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-amber-500 text-sm">warning</span>
            Recent Safety Changes & Alerts
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/50 p-4 rounded-lg border border-slate-100">
            {briefContent.changes_since_last_visit || 'No changes detected.'}
          </p>
        </div>

        {/* Questions for Doctor */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-teal-600 text-sm">question_answer</span>
            Questions for Your Doctor
          </h3>
          
          <p className="text-xs text-slate-500 leading-relaxed">
            Review and personalize questions to ask during your consultation. Avoid questions that make treatment change assumptions.
          </p>

          <div className="space-y-2">
            {briefContent.questions.map((q, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-slate-50/80 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-700 font-medium">
                  {idx + 1}. {q}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveQuestion(idx)}
                  className="text-slate-400 hover:text-red-600 transition-colors flex-shrink-0 cursor-pointer"
                  title="Remove question"
                >
                  <span className="material-symbols-outlined text-sm font-bold">close</span>
                </button>
              </div>
            ))}
            {briefContent.questions.length === 0 && (
              <p className="text-xs text-slate-400 italic">No questions added yet.</p>
            )}
          </div>

          <form onSubmit={handleAddQuestion} className="flex gap-2 border-t border-slate-100 pt-3">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="e.g. Is there any sign of liver stress I should watch out for?"
              className="flex-grow bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-indigo-600"
            />
            <button
              type="submit"
              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs px-4 py-2 rounded font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              Add Question
            </button>
          </form>
        </div>

        {/* Patient Notes */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-indigo-600 text-sm">edit_note</span>
            Custom Patient Notes
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Write down any notes, side-effects, or observations you want to report to the doctor.
          </p>
          <textarea
            value={briefContent.notes}
            onChange={(e) => setBriefContent(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Type any side-effects, updates, or custom notes here..."
            rows={5}
            className="w-full bg-white border border-slate-200 rounded-lg p-4 text-xs focus:outline-none focus:border-indigo-650"
          ></textarea>
        </div>

        {/* Disclaimer */}
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-center">
          <p className="text-[11px] text-amber-800 italic leading-relaxed">
            {briefContent.disclaimer}
          </p>
        </div>

        {/* Save/Submit Action */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="bg-transparent border border-slate-250 text-slate-600 hover:bg-slate-50 font-bold text-xs py-3 px-6 rounded-lg transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs py-3 px-6 rounded-lg transition-all cursor-pointer shadow-sm"
          >
            {saving ? 'Saving...' : 'Save & Compile Brief'}
          </button>
        </div>

      </div>

    </main>
  )
}
