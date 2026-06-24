"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface AutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  onSelect?: (val: string) => void; // fires ONLY on explicit selection
  suggestions: string[];
  placeholder?: string;
  className?: string;
  type?: string;
}

export default function AutocompleteInput({
  id,
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  className = "",
  type = "text",
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  // Position of the dropdown in screen coordinates
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter suggestions — only when user has typed something
  const filtered =
    value.trim().length > 0
      ? suggestions
          .filter(
            (s) =>
              s.toLowerCase().includes(value.toLowerCase()) && s !== value
          )
          .slice(0, 8)
      : [];

  const showDropdown = open && filtered.length > 0;

  // Recalculate dropdown position whenever it becomes visible
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropPos({
      top: rect.bottom + window.scrollY + 2,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (showDropdown) updatePosition();
  }, [showDropdown, updatePosition]);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
      ) {
        setOpen(false);
        setHighlighted(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if ((e.key === "Enter" || e.key === "Tab") && highlighted >= 0) {
      e.preventDefault();
      // ✅ Only fills on EXPLICIT keyboard selection
      onChange(filtered[highlighted]);
      onSelect?.(filtered[highlighted]);
      setOpen(false);
      setHighlighted(-1);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
    }
  };

  const handleSelect = (suggestion: string) => {
    // ✅ Only fills on EXPLICIT mouse click
    onChange(suggestion);
    onSelect?.(suggestion);
    setOpen(false);
    setHighlighted(-1);
  };

  const dropdown = showDropdown
    ? createPortal(
        <ul
          ref={listRef}
          style={{
            position: "absolute",
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
          }}
          className="bg-[#1c1c1c] border border-white/15 shadow-2xl max-h-56 overflow-auto"
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={(e) => e.preventDefault()} // prevent blur before click
              onClick={() => handleSelect(s)}
              className={`px-3 py-2.5 text-xs cursor-pointer select-none flex items-center justify-between transition-colors
                ${
                  i === highlighted
                    ? "bg-gold-primary/20 text-gold-primary"
                    : "text-gray-200 hover:bg-white/5"
                }`}
            >
              <span>{s}</span>
              {i === highlighted && (
                <span className="text-[9px] text-gold-primary/50 uppercase tracking-widest ml-2 flex-shrink-0">
                  ↵ select
                </span>
              )}
            </li>
          ))}
        </ul>,
        document.body
      )
    : null;

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(e) => {
          // ✅ Field always shows exactly what the user typed — never auto-replaced
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(-1);
          updatePosition();
        }}
        onFocus={() => {
          setOpen(true);
          updatePosition();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={className}
      />
      {dropdown}
    </>
  );
}
