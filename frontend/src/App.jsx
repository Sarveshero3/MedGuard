import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Upload from './pages/Upload.jsx'
import MedicineList from './pages/MedicineList.jsx'
import Alerts from './pages/Alerts.jsx'
import CaregiverDashboard from './pages/CaregiverDashboard.jsx'
import Calendar from './pages/Calendar.jsx'
import PrivacySettings from './pages/PrivacySettings.jsx'
import NotFound from './pages/NotFound.jsx'
import Home from './pages/Home.jsx'
import Layout from './components/Layout.jsx'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/medicines" element={<MedicineList />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/caregiver" element={<CaregiverDashboard />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/privacy" element={<PrivacySettings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App

