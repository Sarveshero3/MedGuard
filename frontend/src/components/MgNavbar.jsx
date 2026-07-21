import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export function MgNavbar() {
  const { user, logout, activePatientId } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [alertCount, setAlertCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const headerRef = useRef(null)

  useEffect(() => {
    if (!user) return;
    if (user.role === 'caregiver' && !activePatientId) {
      setAlertCount(0);
      return;
    }
    
    const checkAlerts = async () => {
      try {
        const res = await api.get('/alerts', { params: { patient_id: activePatientId } });
        const active = res.data.data.filter(a => a.status === 'shown');
        setAlertCount(active.length);
      } catch (err) {
        // Silence errors
      }
    };
    
    checkAlerts();
    const interval = setInterval(checkAlerts, 8000);
    return () => clearInterval(interval);
  }, [user, activePatientId]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [mobileMenuOpen]);

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
        setPillStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth
        })
      }
    }
  }, [activeIndex, user, location.pathname])

  return (
    <header ref={headerRef} className="bg-white border-b border-slate-200/80 sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="flex justify-between items-center w-full px-6 md:px-16 max-w-[1200px] mx-auto h-20">
        
        {/* Brand Wordmark Logo */}
        <div 
          className="font-serif text-2xl font-bold cursor-pointer" 
          onClick={() => navigate(user ? '/dashboard' : '/')}
        >
          MedGuard
        </div>

        {/* Sliding Button Tab Navigation (Desktop) */}
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
                  <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-bold shadow-2xs ${
                    isActive ? 'bg-white text-[#0f766e]' : 'bg-rose-600 text-white'
                  }`}>
                    {alertCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User profile and logout button unit */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { logout(); navigate('/login'); }}
            className="hidden md:block text-xs font-semibold text-slate-600 hover:text-[#0F766E] hover:border-[#0F766E]/20 px-4 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-200 cursor-pointer"
          >
            Logout
          </button>

          {/* Hamburger Menu Toggle (Mobile) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200 flex items-center justify-center"
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined text-2xl block">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

      </div>

      {/* Mobile Navigation Dropdown Menu (< 768px) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 bg-white px-6 py-4 flex flex-col gap-1.5 shadow-lg animate-fade-in text-left">
          {tabs.map((tab, idx) => {
            const isActive = activeIndex === idx
            return (
              <Link
                key={tab.path}
                to={tab.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-between transition-colors ${
                  isActive 
                    ? 'bg-[#0F766E] text-white font-bold shadow-xs' 
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{tab.name}</span>
                {tab.name === 'Alerts' && alertCount > 0 && (
                  <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                    isActive ? 'bg-white text-[#0f766e]' : 'bg-rose-600 text-white'
                  }`}>
                    {alertCount}
                  </span>
                )}
              </Link>
            )
          })}

          <div className="pt-2 mt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                logout()
                navigate('/login')
              }}
              className="w-full text-left font-semibold text-rose-600 hover:bg-rose-50 px-4 py-2.5 rounded-xl border border-rose-100 flex items-center gap-2 transition-colors cursor-pointer text-sm"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
