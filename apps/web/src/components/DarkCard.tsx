"use client";

import React from "react";

interface DarkCardProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  hoverGlow?: boolean;
  style?: React.CSSProperties;
}

export const DarkCard: React.FC<DarkCardProps> = ({ 
  children, 
  header, 
  footer, 
  className = "", 
  onClick,
  selected,
  hoverGlow,
  style = {}
}) => {
  const baseStyle: React.CSSProperties = {
    backgroundColor: "var(--color-surface)",
    border: `0.5px solid ${selected ? "var(--color-purple)" : "var(--color-border)"}`,
    borderRadius: "14px",
    transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 1px 1px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)",
    ...style
  };

  return (
    <div 
      style={baseStyle}
      onClick={onClick}
      className={`
        ${className} 
        ${onClick ? "cursor-pointer" : ""} 
        ${hoverGlow ? "hover:border-[rgba(124,92,252,0.4)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)]" : ""}
      `}
    >
      {header && (
        <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.04)] bg-white/[0.01]">
          {header}
        </div>
      )}
      <div className="px-6 py-6">
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.04)] bg-white/[0.02]">
          {footer}
        </div>
      )}
    </div>
  );
};
