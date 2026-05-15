"use client";

import React from "react";

export type BadgeVariant = "teal" | "purple" | "amber" | "orange" | "red" | "gray";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = "gray", className }) => {
  const variants = {
    teal: {
      bg: "rgba(0, 212, 170, 0.1)",
      text: "#00D4AA",
      border: "rgba(0, 212, 170, 0.2)",
    },
    purple: {
      bg: "rgba(124, 92, 252, 0.1)",
      text: "#9B7DFF",
      border: "rgba(124, 92, 252, 0.2)",
    },
    amber: {
      bg: "rgba(245, 158, 11, 0.1)",
      text: "#F59E0B",
      border: "rgba(245, 158, 11, 0.2)",
    },
    orange: {
      bg: "rgba(245, 158, 11, 0.1)",
      text: "#F59E0B",
      border: "rgba(245, 158, 11, 0.2)",
    },
    red: {
      bg: "rgba(255, 85, 102, 0.1)",
      text: "#FF5566",
      border: "rgba(255, 85, 102, 0.2)",
    },
    gray: {
      bg: "rgba(255, 255, 255, 0.05)",
      text: "rgba(240, 240, 245, 0.55)",
      border: "rgba(255, 255, 255, 0.08)",
    },
  };

  const style = variants[variant] || variants.gray;

  return (
    <span 
      className={className}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `0.5px solid ${style.border}`,
        padding: "3px 10px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        letterSpacing: "0.01em"
      }}
    >
      {variant === "teal" && (
        <span style={{ width: "5px", height: "5px", backgroundColor: "#00D4AA", borderRadius: "50%", display: "inline-block", boxShadow: "0 0 8px #00D4AA" }}></span>
      )}
      {children}
    </span>
  );
};
