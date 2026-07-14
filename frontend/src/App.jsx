import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Upload from './pages/Upload.jsx'
import MedicineList from './pages/MedicineList.jsx'
import Alerts from './pages/Alerts.jsx'
import CaregiverDashboard from './pages/CaregiverDashboard.jsx'
import Calendar from './pages/Calendar.jsx'
import Home from './pages/Home.jsx'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/medicines" element={<MedicineList />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/caregiver" element={<CaregiverDashboard />} />
      <Route path="/calendar" element={<Calendar />} />
    </Routes>
  )
}

export default App

