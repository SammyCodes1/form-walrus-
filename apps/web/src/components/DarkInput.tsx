"use client";

import React from "react";

interface DarkInputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  isTextArea?: boolean;
}

export const DarkInput: React.FC<DarkInputProps> = ({ label, error, isTextArea, ...props }) => {
  const baseStyles: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#1a1a2e",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#F0F0F5",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s, background-color 0.15s",
  };

  const focusClasses = "focus:border-[rgba(124,92,252,0.5)] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.1)] focus:bg-white/[0.05]";

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <label className="text-[11px] font-bold uppercase tracking-widest text-white/30 ml-1">
          {label}
        </label>
      )}
      {isTextArea ? (
        <textarea
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          style={baseStyles}
          className={focusClasses}
        />
      ) : (
        <input
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          style={baseStyles}
          className={focusClasses}
        />
      )}
      {error && <span className="text-[10px] font-bold text-red-500 mt-1 ml-1 uppercase tracking-wider">{error}</span>}
    </div>
  );
};
