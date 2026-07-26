"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  AI_PROVIDER_OPTIONS,
  storeAiProvider,
  type AiProvider,
} from "@/lib/ai/providers";

interface ModelSelectProps {
  value: AiProvider;
  onChange: (value: AiProvider) => void;
  disabled?: boolean;
  /**
   * ghost — compact inline pill that sits in a composer footer (default).
   * field — bordered, full-width control for settings panels.
   */
  variant?: "ghost" | "field";
  /** Which trigger edge the menu lines up with. */
  align?: "left" | "right";
}

const ROW_HEIGHT = 34;
const MENU_PADDING = 10;
const MENU_WIDTH = 268;
const GAP = 6;

export default function ModelSelect({
  value,
  onChange,
  disabled = false,
  variant = "ghost",
  align = "left",
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedIndex = Math.max(
    0,
    AI_PROVIDER_OPTIONS.findIndex((o) => o.value === value)
  );
  const selected = AI_PROVIDER_OPTIONS[selectedIndex];
  const isField = variant === "field";

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = isField ? Math.max(r.width, MENU_WIDTH) : MENU_WIDTH;
    const height = AI_PROVIDER_OPTIONS.length * ROW_HEIGHT + MENU_PADDING * 2;
    const fitsBelow = window.innerHeight - r.bottom >= height + GAP + 8;

    const rawLeft = align === "right" ? r.right - width : r.left;
    setBox({
      top: fitsBelow
        ? r.bottom + GAP
        : Math.max(8, r.top - height - GAP),
      left: Math.min(Math.max(8, rawLeft), window.innerWidth - width - 8),
      width,
    });
  };

  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const reposition = () => place();
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const last = AI_PROVIDER_OPTIONS.length - 1;
      switch (e.key) {
        case "Escape":
        case "Tab":
          setOpen(false);
          triggerRef.current?.focus();
          break;
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => (i >= last ? 0 : i + 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => (i <= 0 ? last : i - 1));
          break;
        case "Home":
          e.preventDefault();
          setActiveIndex(0);
          break;
        case "End":
          e.preventDefault();
          setActiveIndex(last);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          commit(AI_PROVIDER_OPTIONS[activeIndex]?.value ?? value);
          break;
      }
    };

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex, value]);

  const commit = (next: AiProvider) => {
    storeAiProvider(next);
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const toggle = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setOpen((v) => !v);
  };

  const menu =
    open && !disabled && box && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Model"
            style={{
              position: "fixed",
              top: box.top,
              left: box.left,
              width: box.width,
              zIndex: 400,
              padding: MENU_PADDING - 4,
              border: "1px solid var(--pd-border)",
              borderRadius: 10,
              background: "var(--pd-surface-raised)",
              boxShadow: "var(--pd-shadow-lg)",
              fontFamily: "inherit",
            }}
          >
            {AI_PROVIDER_OPTIONS.map((option, i) => {
              const isSelected = option.value === value;
              const isActive = i === activeIndex;
              return (
                <div
                  key={option.value || "auto"}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onPointerEnter={() => setActiveIndex(i)}
                  onClick={() => commit(option.value)}
                  title={option.description}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: ROW_HEIGHT,
                    padding: "0 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: isActive ? "var(--pd-bg-muted)" : "transparent",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12.5,
                      fontWeight: isSelected ? 600 : 500,
                      color: "var(--pd-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {option.label}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11,
                      color: "var(--pd-text-subtle)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {option.hint}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      width: 12,
                      display: "grid",
                      placeItems: "center",
                      color: "var(--pd-brand)",
                      opacity: isSelected ? 1 : 0,
                    }}
                  >
                    <CheckIcon />
                  </span>
                </div>
              );
            })}
          </div>,
          document.body
        )
      : null;

  const showAffordance = open || hover;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Select model"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        style={
          isField
            ? {
                ...baseTrigger,
                width: "100%",
                justifyContent: "space-between",
                height: 34,
                padding: "0 10px",
                border: "1px solid var(--pd-border)",
                borderRadius: "var(--pd-radius)",
                background: "var(--pd-bg-subtle)",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--pd-text)",
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
              }
            : {
                ...baseTrigger,
                height: 24,
                padding: "0 6px",
                border: "1px solid transparent",
                borderRadius: 6,
                background: showAffordance ? "var(--pd-bg-muted)" : "transparent",
                fontSize: 12,
                fontWeight: 500,
                color: showAffordance ? "var(--pd-text)" : "var(--pd-text-muted)",
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
              }
        }
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected.label}
        </span>
        <ChevronIcon open={open} />
      </button>
      {menu}
    </>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        flexShrink: 0,
        opacity: 0.7,
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 120ms ease",
      }}
    >
      <path
        d="M3 4.5 6 7.5 9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 6.5 4.75 8.75 9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const baseTrigger: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  maxWidth: "100%",
  fontFamily: "inherit",
  lineHeight: 1,
  transition: "background 120ms ease, color 120ms ease",
};
