import * as React from "react"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, id, ...props }, ref) => {
  const [isChecked, setIsChecked] = React.useState(checked || false)

  React.useEffect(() => {
    if (checked !== undefined) {
      setIsChecked(checked)
    }
  }, [checked])

  const handleChange = (e) => {
    const newChecked = e.target.checked
    if (checked === undefined) {
      setIsChecked(newChecked)
    }
    if (onCheckedChange) {
      onCheckedChange(newChecked)
    }
  }

  return (
    <div className="relative flex items-center justify-center">
      <input
        type="checkbox"
        id={id}
        checked={isChecked}
        onChange={handleChange}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded border border-slate-300 bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0F766E] disabled:cursor-not-allowed disabled:opacity-50 appearance-none checked:bg-[#0F766E] checked:border-[#0F766E]",
          className
        )}
        ref={ref}
        {...props}
      />
      <span className="absolute text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity duration-150">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="3.5"
          stroke="currentColor"
          className="w-2.5 h-2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </span>
    </div>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
