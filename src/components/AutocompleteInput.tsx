"use client";

import { useState, useRef, useEffect } from "react";

interface AutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  onSelect?: (val: string) => void; // fires ONLY on explicit selection
  suggestions: string[];
  placeholder?: string;
  className?: string;
  type?: string;
  hint?: string;
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
  hint,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter suggestions: only show if there is typed text
  const filtered = value.trim().length > 0
    ? suggestions.filter(s =>
        s.toLowerCase().includes(value.toLowerCase()) && s !== value
      ).slice(0, 8)
    : [];

  const showDropdown = open && filtered.length > 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if ((e.key === "Enter" || e.key === "Tab") && highlighted >= 0) {
      e.preventDefault();
      // Only fill on explicit keyboard selection
      onChange(filtered[highlighted]);
      onSelect?.(filtered[highlighted]); // notify parent of explicit selection
      setOpen(false);
      setHighlighted(-1);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
    }
  };

  const handleSelect = (suggestion: string) => {
    // Only fill on explicit mouse click selection
    onChange(suggestion);
    onSelect?.(suggestion); // notify parent of explicit selection
    setOpen(false);
    setHighlighted(-1);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        id={id}
        type={type}
        value={value}
        // User's typed text is preserved exactly — no auto-fill
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />

      {/* Suggestion Dropdown */}
      {showDropdown && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-[#1a1a1a] border border-white/10 shadow-2xl max-h-56 overflow-auto">
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={e => e.preventDefault()} // prevent blur before click
              onClick={() => handleSelect(s)}
              className={`px-3 py-2 text-xs cursor-pointer select-none flex items-center justify-between transition-colors
                ${i === highlighted
                  ? "bg-gold-primary/20 text-gold-primary"
                  : "text-gray-200 hover:bg-white/5"
                }`}
            >
              <span>{s}</span>
              {i === highlighted && (
                <span className="text-[9px] text-gold-primary/60 uppercase tracking-widest ml-2">↵</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Optional hint row below input — display only, never auto-fills */}
      {hint && (
        <p className="mt-1 text-[9px] text-gray-500 leading-tight">{hint}</p>
      )}
    </div>
  );
}
