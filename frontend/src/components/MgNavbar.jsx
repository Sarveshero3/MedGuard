import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export function MgNavbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [alertCount, setAlertCount] = useState(0)
  const lastCountRef = useRef(0)
  const [showToast, setShowToast] = useState(null)
  
  useEffect(() => {
    if (!user) return;
    
    const checkAlerts = async () => {
      try {
        const res = await api.get('/alerts', { params: { patient_id: user.id } });
        const active = res.data.data.filter(a => a.status === 'shown');
        setAlertCount(active.length);
        if (active.length > lastCountRef.current) {
          const newAlert = active[active.length - 1];
          setShowToast(`⚠️ New Drug Interaction Flagged: ${newAlert.drug_name_a} & ${newAlert.drug_name_b}`);
          setTimeout(() => setShowToast(null), 6000);
        }
        lastCountRef.current = active.length;
      } catch (err) {
        // Silence errors
      }
    };
    
    checkAlerts();
    const interval = setInterval(checkAlerts, 8000);
    return () => clearInterval(interval);
  }, [user]);

  const tabs = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Upload', path: '/upload' },
    { name: 'Medicines', path: '/medicines' },
    { name: 'Lab Reports', path: '/lab-reports' },
    { name: 'Alerts', path: '/alerts' },
    { name: 'Calendar', path: '/calendar' },
  ]
  
  tabs.push({ name: 'Privacy', path: '/privacy' })

  // Find active index
  const activeIndex = tabs.findIndex(tab => location.pathname === tab.path)

  // Measure positions using refs and container coordinates
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })
  const containerRef = useRef(null)
  const tabRefs = useRef([])

  useEffect(() => {
    if (activeIndex !== -1 && tabRefs.current[activeIndex]) {
      const activeEl = tabRefs.current[activeIndex]
      const containerEl = containerRef.current
      if (activeEl && containerEl) {
        const activeRect = activeEl.getBoundingClientRect()
        const containerRect = containerEl.getBoundingClientRect()
        setPillStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth
        })
      }
    }
  }, [activeIndex, user, location.pathname])

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {showToast && (
        <div className="fixed top-24 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg border border-slate-800 z-50 flex items-center gap-3 transition-all duration-300 animate-pulse">
          <span className="material-symbols-outlined text-amber-400">warning</span>
          <div className="text-xs font-semibold">{showToast}</div>
          <button onClick={() => setShowToast(null)} className="text-slate-400 hover:text-white ml-2 text-xs font-bold">×</button>
        </div>
      )}
      <div className="flex justify-between items-center w-full px-6 md:px-16 max-w-[1200px] mx-auto h-20">
        
        {/* Brand Wordmark Logo */}
        <div 
          className="font-serif text-2xl font-bold cursor-pointer" 
          onClick={() => navigate(user ? '/dashboard' : '/')}
        >
          MedGuard
        </div>

        {/* Sliding Button Tab Navigation */}
        <nav 
          ref={containerRef}
          className="hidden md:flex relative items-center bg-[#f1f5f9] p-1 rounded-full border border-slate-200/40"
        >
          {/* Sliding Pill */}
          {activeIndex !== -1 && (
            <div 
              className="absolute top-1 bottom-1 bg-[#0F766E] rounded-full transition-all duration-300 ease-out shadow-sm"
              style={{
                left: `${pillStyle.left}px`,
                width: `${pillStyle.width}px`
              }}
            />
          )}

          {/* Tab Links */}
          {tabs.map((tab, idx) => {
            const isActive = activeIndex === idx
            return (
              <Link
                key={tab.path}
                to={tab.path}
                ref={el => tabRefs.current[idx] = el}
                className={`relative z-10 px-4 py-1.5 text-xs md:text-sm font-semibold no-underline transition-colors duration-300 rounded-full select-none flex items-center gap-1.5 ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>{tab.name}</span>
                {tab.name === 'Alerts' && alertCount > 0 && (
                  <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-bold shadow-sm ${
                    isActive ? 'bg-white text-[#0f766e]' : 'bg-red-600 text-white animate-pulse'
                  }`}>
                    {alertCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User profile and logout button unit */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { logout(); navigate('/login'); }}
            className="hidden md:block text-xs font-semibold text-slate-600 hover:text-[#0F766E] hover:border-[#0F766E]/20 px-4 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-200 cursor-pointer"
          >
            Logout
          </button>
          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
            <img 
              alt="User profile" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDc1UtHH_KPWlO__6M1SXW4Af__3PQftJcB63NS-gU9ePpgYv2SqA9sS5S2UyRIHbvORljvPJ8m326fgEezBvhtsSZMKobEH2pLwSEWG66u8ISmyDo33roqneTxuX2Vo4aUTrx9lzxoJa62UtRBhDw6JYB5LVK0nbmgD9g13VjrZV20on1Fgz49N49dxJeZEZrFZSyFSw3n0I3Ook_Wk1d7OUdEYTEOWaKBfFvVn-BncGy6RJ0BjRx2"
            />
          </div>
        </div>

      </div>
    </header>
  )
}
