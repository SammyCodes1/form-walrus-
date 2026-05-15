"use client";

import React from "react";

export const Spinner: React.FC<{ size?: number, color?: string }> = ({ size = 24, color = "#7C5CFC" }) => {
  return (
    <div className="flex items-center justify-center">
      <div 
        style={{
          width: size,
          height: size,
          border: "2px solid rgba(255, 255, 255, 0.05)",
          borderTopColor: color,
          borderRightColor: color,
          borderRadius: "50%",
        }}
        className="animate-spin"
      />
    </div>
  );
};
