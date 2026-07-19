import React from 'react';

export function InfoButton({ fieldName, description, example, onShowInfo, className = '' }) {
  if (!onShowInfo) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onShowInfo({ fieldName, description, example });
      }}
      className={`inline-flex items-center justify-center p-0 border-0 bg-transparent shadow-none text-slate-405 hover:text-[#0f766e] focus:outline-none transition-colors align-middle cursor-pointer flex-shrink-0 select-none ${className}`}
      title={`Help for ${fieldName}`}
      aria-label={`Show info for ${fieldName}`}
    >
      <span className="material-symbols-outlined text-[13px] leading-none">info</span>
    </button>
  );
}
