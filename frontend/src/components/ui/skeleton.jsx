import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("skeleton-loader rounded-md bg-slate-200/80", className)}
      {...props}
    />
  )
}

export { Skeleton }
