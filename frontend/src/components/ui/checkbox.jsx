import * as React from "react"

const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, id, ...props }, ref) => {
  const [internalChecked, setInternalChecked] = React.useState(false)
  const isControlled = checked !== undefined
  const isChecked = isControlled ? checked : internalChecked

  const handleChange = (e) => {
    const newVal = e.target.checked
    if (!isControlled) setInternalChecked(newVal)
    if (onCheckedChange) onCheckedChange(newVal)
  }

  return (
    <span className="inline-flex items-center justify-center shrink-0">
      {/* Hidden native input for form submission + a11y */}
      <input
        type="checkbox"
        id={id}
        checked={isChecked}
        onChange={handleChange}
        ref={ref}
        className="sr-only"
        {...props}
      />
      {/* Visual checkbox — a plain div, no appearance-none tricks */}
      <label
        htmlFor={id}
        className="cursor-pointer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          border: isChecked ? '2px solid #0F766E' : '2px solid #cbd5e1',
          backgroundColor: isChecked ? '#0F766E' : '#ffffff',
          transition: 'background-color 0.15s, border-color 0.15s',
          flexShrink: 0,
        }}
      >
        {/* White tick — only rendered when checked so it's never invisible */}
        {isChecked && (
          <svg viewBox="0 0 12 10" fill="none" style={{ width: '10px', height: '10px' }}>
            <path
              d="M1.5 5l3.5 3.5 5.5-8"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </label>
    </span>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
