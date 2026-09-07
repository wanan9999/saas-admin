import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react"

interface Toast {
  id: number
  message: string
  type: "error" | "success"
}

interface ToastContextType {
  addToast: (message: string, type?: "error" | "success") => void
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: "error" | "success" = "error") => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed inset-x-4 bottom-4 z-[70] space-y-2 sm:left-auto sm:right-4 sm:max-w-sm" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`ui-toast rounded-xl border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-xl ${
              t.type === "error"
                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-950 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

// Global reference for use outside React (in QueryClient config)
let globalAddToast: ((message: string, type?: "error" | "success") => void) | null = null

export function setGlobalToast(fn: typeof globalAddToast) {
  globalAddToast = fn
}

export function showToast(message: string, type: "error" | "success" = "error") {
  if (globalAddToast) globalAddToast(message, type)
}

/** Bridge component that wires up the global toast ref inside the React tree */
export function ToastBridge() {
  const { addToast } = useToast()
  useEffect(() => {
    setGlobalToast(addToast)
  }, [addToast])
  return null
}
