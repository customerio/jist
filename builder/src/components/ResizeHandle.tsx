"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizeHandleProps {
  /** "left" = dragging resizes the panel to the left; "right" = to the right */
  side: "left" | "right";
  onResize: (delta: number) => void;
}

export function ResizeHandle({ side, onResize }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startX.current = e.clientX;
      setDragging(true);
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX.current;
      startX.current = e.clientX;
      // "left" side means the panel is to the left, so positive delta = wider
      // "right" side means the panel is to the right, so positive delta = narrower
      onResize(side === "left" ? delta : -delta);
    };

    const handleMouseUp = () => setDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    // Prevent text selection while dragging
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, onResize, side]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`shrink-0 w-1 cursor-col-resize group relative z-10
        ${dragging ? "bg-primary" : "bg-border/40 hover:bg-primary/30"} transition-colors`}
    >
      {/* Wider invisible hit target */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}
