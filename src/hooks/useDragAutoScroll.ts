import { useCallback, useRef } from 'react';

const EDGE_ZONE = 80;
const MAX_SPEED = 15;

export function useDragAutoScroll(containerRef: React.RefObject<HTMLElement | null>) {
  const rafId = useRef<number | null>(null);
  const speed = useRef(0);

  const stopScroll = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    speed.current = 0;
  }, []);

  const tick = useCallback(() => {
    const el = containerRef.current;
    if (!el || speed.current === 0) {
      rafId.current = null;
      return;
    }
    el.scrollLeft += speed.current;
    rafId.current = requestAnimationFrame(tick);
  }, [containerRef]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;

    if (x < EDGE_ZONE) {
      // Left edge — scroll left (negative)
      const ratio = 1 - x / EDGE_ZONE;
      speed.current = -Math.round(ratio * MAX_SPEED);
    } else if (x > w - EDGE_ZONE) {
      // Right edge — scroll right (positive)
      const ratio = 1 - (w - x) / EDGE_ZONE;
      speed.current = Math.round(ratio * MAX_SPEED);
    } else {
      speed.current = 0;
    }

    if (speed.current !== 0 && rafId.current === null) {
      rafId.current = requestAnimationFrame(tick);
    } else if (speed.current === 0) {
      stopScroll();
    }
  }, [containerRef, tick, stopScroll]);

  return { handleDragOver, stopScroll };
}
