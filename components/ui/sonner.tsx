"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, CircleXIcon, InfoIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon strokeWidth={2} className="size-4" />
        ),
        info: (
          <InfoIcon strokeWidth={2} className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon strokeWidth={2} className="size-4" />
        ),
        error: (
          <CircleXIcon strokeWidth={2} className="size-4" />
        ),
        loading: (
          <LoaderCircleIcon strokeWidth={2} className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--material-thick)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--hairline)",
          "--border-radius": "calc(var(--radius) * 1.2)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
