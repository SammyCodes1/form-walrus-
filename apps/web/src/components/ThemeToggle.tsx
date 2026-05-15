"use client";
import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "36px",
        borderRadius: "12px",
        transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
        cursor: "pointer",
        background: theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)",
        border: theme === "dark" ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid rgba(0,0,0,0.1)",
        color: theme === "dark" ? "#F0F0F5" : "#050507",
      }}
      className="hover:scale-105 active:scale-95 group"
    >
      {theme === "dark" ? (
        <Moon size={16} className="group-hover:text-purple-400 transition-colors" />
      ) : (
        <Sun size={16} className="group-hover:text-amber-500 transition-colors" />
      )}
    </button>
  );
}
