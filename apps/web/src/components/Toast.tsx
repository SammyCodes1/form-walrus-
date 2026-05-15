"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Info, X, XCircle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = "info", duration = 4000, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const icons = {
    success: <CheckCircle className="text-[#00D4AA]" size={18} />,
    error: <XCircle className="text-[#FF5566]" size={18} />,
    info: <Info className="text-[#7C5CFC]" size={18} />,
    warning: <AlertCircle className="text-[#F59E0B]" size={18} />,
  };

  const accentColors = {
    success: "#00D4AA",
    error: "#FF5566",
    info: "#7C5CFC",
    warning: "#F59E0B",
  };

  return (
    <div className={`
      fixed bottom-8 right-8 z-[5000] flex items-center gap-4 px-5 py-4
      rounded-2xl border backdrop-blur-[20px] saturate-[180%] shadow-2xl transition-all duration-300
      bg-[rgba(12,12,16,0.85)] border-[rgba(255,255,255,0.08)]
      ${isExiting ? "opacity-0 translate-x-10 scale-95" : "opacity-100 translate-x-0 scale-100 animate-slide-in-right"}
    `}>
      <div 
        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
        style={{ backgroundColor: accentColors[type] }}
      />
      <div className="flex-shrink-0">
        {icons[type]}
      </div>
      <p className="text-[13px] font-semibold text-[#F0F0F5]">
        {message}
      </p>
      <button 
        onClick={handleClose}
        className="ml-2 text-white/20 hover:text-white transition-colors p-1"
      >
        <X size={14} />
      </button>
    </div>
  );
}
