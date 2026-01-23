import clsx from "clsx"

type ButtonProps = {
  children: React.ReactNode
  onClick?: () => void
  type?: "button" | "submit" | "reset"
  variant?: "primary" | "secondary" | "danger"
  disabled?: boolean
  className?: string
}

export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer",
        {
          "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500":
            variant === "primary" && !disabled,
          "bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-400":
            variant === "secondary" && !disabled,
          "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500":
            variant === "danger" && !disabled,
          "opacity-50 cursor-not-allowed": disabled,
        },
        className
      )}
    >
      {children}
    </button>
  )
}