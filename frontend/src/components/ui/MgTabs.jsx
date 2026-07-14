import React from 'react'

export function MgTabs({ value, onValueChange, tabs, defaultValue }) {
  const [activeTab, setActiveTab] = React.useState(value !== undefined ? value : defaultValue)

  const handleTabClick = (val) => {
    if (value === undefined) {
      setActiveTab(val)
    }
    if (onValueChange) {
      onValueChange(val)
    }
  }

  React.useEffect(() => {
    if (value !== undefined) {
      setActiveTab(value)
    }
  }, [value])

  return (
    <div className="w-full bg-[#f4f8f8] p-1.5 rounded-xl flex gap-1.5 mb-8 border border-slate-200/50" role="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleTabClick(tab.value)}
            className={`flex-1 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer rounded-lg text-center outline-none border-0 ${
              isActive 
                ? 'bg-white text-[#0B1F33] shadow-sm border-b-2 border-[#0F766E]' 
                : 'bg-transparent text-slate-500 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
