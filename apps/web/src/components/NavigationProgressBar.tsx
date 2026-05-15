"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function Progress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    setProgress(30);
    
    const timer = setTimeout(() => {
      setProgress(100);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 400);
      return () => clearTimeout(hideTimer);
    }, 150);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div 
      style={{ 
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        zIndex: 9999,
        pointerEvents: "none"
      }}
    >
      <div 
        style={{ 
          height: "100%",
          width: `${progress}%`, 
          background: "linear-gradient(90deg, #7C5CFC, #00D4AA)",
          boxShadow: "0 0 10px rgba(124,92,252,0.5)",
          transition: "width 0.4s ease, opacity 0.3s ease",
          opacity: progress === 100 ? 0 : 1,
        }} 
      />
    </div>
  );
}

export function NavigationProgressBar() {
  return (
    <Suspense fallback={null}>
      <Progress />
    </Suspense>
  );
}
