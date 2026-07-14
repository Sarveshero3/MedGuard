import React from 'react'
import { Outlet } from 'react-router-dom'
import { MgNavbar } from './MgNavbar'

export default function Layout() {
  return (
    <div className="font-sans text-[#181c1d] antialiased min-h-screen flex flex-col bg-[#f6fafa] mg-grid-bg">
      <MgNavbar />
      <Outlet />
    </div>
  )
}
