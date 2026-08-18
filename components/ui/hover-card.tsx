"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "react-aria-components"

import { cn } from "@/lib/utils"

/**
 * The aria base ships no hover-card, so this composes one from react-aria's
 * Popover.
 *
 * Two constraints drove the shape. It renders the trigger element itself
 * rather than wrapping it, so callers keep their own layout and data
 * attributes in the DOM position hit-testing expects. And it never makes the
 * trigger focusable — a focusable trigger would add a tab stop per row, which
 * on a canvas of tables means dozens of them; the same data is reachable from
 * the side panel.
 */
/**
 * Renders a `content` thunk only once the popover actually mounts its children,
 * which it does only while open. Passing a function rather than an element is
 * how a caller keeps expensive lookups out of the trigger's render — a card
 * with a row per column would otherwise resolve every row's popover body on
 * every render, for rows nobody is pointing at.
 */
const LazyContent = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>

function HoverCard({
  content,
  children,
  className,
  placement = "right",
  openDelay = 350,
  closeDelay = 120,
  isDisabled = false,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  ...props
  // "content" is also a global HTML attribute, so it must be replaced, not merged.
}: Omit<React.ComponentProps<"div">, "content"> & {
  content: React.ReactNode | (() => React.ReactNode)
  placement?: React.ComponentProps<typeof PopoverPrimitive>["placement"]
  openDelay?: number
  closeDelay?: number
  isDisabled?: boolean
}) {
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  const schedule = React.useCallback((open: boolean, delay: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setIsOpen(open), delay)
  }, [])

  const dismiss = React.useCallback(() => {
    clearTimeout(timer.current)
    setIsOpen(false)
  }, [])

  React.useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <>
      <div
        ref={triggerRef}
        data-slot="hover-card-trigger"
        className={className}
        {...props}
        // Composed, not spread over: triggers are often also drag handles, and
        // a caller's own pointer handler must not silently replace these.
        onPointerEnter={(event) => {
          onPointerEnter?.(event)
          // Touch has no hover, and a press there would fight the card.
          if (!isDisabled && event.pointerType === "mouse")
            schedule(true, openDelay)
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event)
          schedule(false, closeDelay)
        }}
        onPointerDown={(event) => {
          // Any press starts a drag or a link, so the card must go immediately.
          dismiss()
          onPointerDown?.(event)
        }}
      >
        {children}
      </div>
      <PopoverPrimitive
        triggerRef={triggerRef}
        isOpen={isOpen && !isDisabled}
        onOpenChange={setIsOpen}
        placement={placement}
        offset={8}
        // Non-modal so the canvas underneath stays interactive and focus stays put.
        isNonModal
        data-slot="hover-card"
        className={cn(
          "z-50 w-72 max-w-[min(20rem,calc(100vw-2rem))] rounded-xl bg-popover p-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none",
          "data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95",
          "data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2"
        )}
      >
        {typeof content === "function" ? <LazyContent render={content} /> : content}
      </PopoverPrimitive>
    </>
  )
}

export { HoverCard }
