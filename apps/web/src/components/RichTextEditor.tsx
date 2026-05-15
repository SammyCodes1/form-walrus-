"use client";

import { useRef, useEffect, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Type your response...",
  minHeight = 160,
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    unorderedList: false,
    orderedList: false,
  });
  const [isEmpty, setIsEmpty] = useState(true);

  // Set initial value
  useEffect(() => {
    if (editorRef.current && value && 
        editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
      setIsEmpty(!value || value === "<br>");
    }
  }, []);

  // Update active format states on selection change
  const updateFormatStates = () => {
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      unorderedList: document.queryCommandState("insertUnorderedList"),
      orderedList: document.queryCommandState("insertOrderedList"),
    });
  };

  const execFormat = (command: string, value?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateFormatStates();
    handleChange();
  };

  const handleChange = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const plain = editorRef.current.innerText || "";
    const empty = !plain.trim() || html === "<br>";
    setIsEmpty(empty);
    onChange(empty ? "" : html, plain);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Bold: Ctrl+B
    if (e.ctrlKey && e.key === "b") {
      e.preventDefault();
      execFormat("bold");
    }
    // Italic: Ctrl+I
    if (e.ctrlKey && e.key === "i") {
      e.preventDefault();
      execFormat("italic");
    }
    // Underline: Ctrl+U
    if (e.ctrlKey && e.key === "u") {
      e.preventDefault();
      execFormat("underline");
    }
  };

  const toolbarButtons = [
    { 
      command: "bold", 
      label: "B", 
      title: "Bold (Ctrl+B)",
      style: { fontWeight: 700 },
    },
    { 
      command: "italic", 
      label: "I", 
      title: "Italic (Ctrl+I)",
      style: { fontStyle: "italic" },
    },
    { 
      command: "underline", 
      label: "U", 
      title: "Underline (Ctrl+U)",
      style: { textDecoration: "underline" },
    },
    null, // divider
    { 
      command: "insertUnorderedList", 
      label: "• List", 
      title: "Bullet list",
      style: {},
    },
    { 
      command: "insertOrderedList", 
      label: "1. List", 
      title: "Numbered list",
      style: {},
    },
    null, // divider
    { 
      command: "formatBlock", 
      label: "H2", 
      title: "Heading",
      style: { fontWeight: 600 },
      value: "h2",
    },
    { 
      command: "formatBlock", 
      label: "¶", 
      title: "Paragraph",
      style: {},
      value: "p",
    },
    null, // divider
    { 
      command: "removeFormat", 
      label: "✕ Clear", 
      title: "Clear formatting",
      style: { fontSize: "11px" },
    },
  ];

  return (
    <div style={{
      border: "0.5px solid rgba(255,255,255,0.08)",
      borderRadius: "10px",
      overflow: "hidden",
      background: "rgba(255,255,255,0.03)",
      transition: "border-color 0.15s, box-shadow 0.15s",
      opacity: disabled ? 0.6 : 1,
    }}
    onFocus={() => {
      const el = document.querySelector(".rte-wrapper") as HTMLElement;
      if (el) {
        el.style.borderColor = "rgba(124,92,252,0.5)";
        el.style.boxShadow = "0 0 0 3px rgba(124,92,252,0.1)";
      }
    }}
    className="rte-wrapper"
    >

      {/* TOOLBAR */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "6px 10px",
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        flexWrap: "wrap",
      }}>
        {toolbarButtons.map((btn, i) => {
          if (btn === null) {
            return (
              <div key={"div-" + i} style={{
                width: "1px",
                height: "16px",
                background: "rgba(255,255,255,0.08)",
                margin: "0 4px",
                flexShrink: 0,
              }} />
            );
          }

          const isActive = 
            btn.command === "bold" 
              ? activeFormats.bold
            : btn.command === "italic" 
              ? activeFormats.italic
            : btn.command === "underline" 
              ? activeFormats.underline
            : btn.command === "insertUnorderedList" 
              ? activeFormats.unorderedList
            : btn.command === "insertOrderedList" 
              ? activeFormats.orderedList
            : false;

          return (
            <button
              key={btn.command + i}
              type="button"
              title={btn.title}
              onMouseDown={e => {
                e.preventDefault(); // prevent blur
                execFormat(btn.command, btn.value);
              }}
              disabled={disabled}
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                border: "0.5px solid " + (
                  isActive
                    ? "rgba(124,92,252,0.5)"
                    : "transparent"
                ),
                background: isActive
                  ? "rgba(124,92,252,0.15)"
                  : "transparent",
                color: isActive
                  ? "#A78BFA"
                  : "rgba(240,240,245,0.5)",
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: "12px",
                fontFamily: "inherit",
                transition: "all 0.15s",
                flexShrink: 0,
                minWidth: "28px",
                textAlign: "center",
                ...btn.style,
              }}
              onMouseEnter={e => {
                if (!isActive && !disabled) {
                  e.currentTarget.style.background = 
                    "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = 
                    "rgba(240,240,245,0.8)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 
                    "transparent";
                  e.currentTarget.style.color = 
                    "rgba(240,240,245,0.5)";
                }
              }}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* EDITABLE AREA */}
      <div style={{ position: "relative" }}>

        {/* Placeholder */}
        {isEmpty && (
          <div style={{
            position: "absolute",
            top: "14px",
            left: "16px",
            color: "rgba(240,240,245,0.25)",
            fontSize: "14px",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 1,
          }}>
            {placeholder}
          </div>
        )}

        {/* Content editable */}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={updateFormatStates}
          onMouseUp={updateFormatStates}
          onSelect={updateFormatStates}
          style={{
            minHeight: minHeight + "px",
            padding: "14px 16px",
            outline: "none",
            fontSize: "14px",
            lineHeight: 1.7,
            color: "rgba(240,240,245,0.9)",
            fontFamily: "inherit",
            position: "relative",
            zIndex: 2,
          }}
          // Style rich text elements via injected CSS
        />
      </div>

      {/* Rich text styles injected */}
      <style>{`
        .rte-wrapper [contenteditable] h2 {
          font-size: 17px;
          font-weight: 600;
          margin: 8px 0 4px;
          color: rgba(240,240,245,0.95);
        }
        .rte-wrapper [contenteditable] ul {
          padding-left: 20px;
          margin: 6px 0;
        }
        .rte-wrapper [contenteditable] ol {
          padding-left: 20px;
          margin: 6px 0;
        }
        .rte-wrapper [contenteditable] li {
          margin: 3px 0;
          color: rgba(240,240,245,0.85);
        }
        .rte-wrapper [contenteditable] b,
        .rte-wrapper [contenteditable] strong {
          color: rgba(240,240,245,0.98);
          font-weight: 700;
        }
        .rte-wrapper [contenteditable] i,
        .rte-wrapper [contenteditable] em {
          color: rgba(240,240,245,0.8);
        }
        .rte-wrapper [contenteditable] u {
          text-decoration-color: rgba(124,92,252,0.6);
        }
        .rte-wrapper [contenteditable]:focus {
          outline: none;
        }
        .rte-wrapper:focus-within {
          border-color: rgba(124,92,252,0.5) !important;
          box-shadow: 0 0 0 3px rgba(124,92,252,0.1) !important;
        }
      `}</style>
    </div>
  );
}
