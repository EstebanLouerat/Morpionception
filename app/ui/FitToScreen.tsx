"use client";

import { ReactNode, useLayoutEffect, useRef } from "react";
import styles from "./FitToScreen.module.css";

// Below this, text would be too small to read: the page has to be laid out to need less
const MIN_ZOOM = 0.55;

/** Shows its content without scrolling: when it is taller than the room it has, it is
 * zoomed out (CSS zoom, so it keeps the full width and its text reflows) by just as
 * much as needed. Pages are laid out to fit; this absorbs the last few lines on
 * small screens. */
const FitToScreen = ({ children, className }: { children: ReactNode; className?: string }) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = outer.current!;
    const content = inner.current!;
    let frame = 0;
    const overflows = () => box.scrollHeight > box.clientHeight + 1;
    const fit = () => {
      box.scrollTop = 0;
      content.style.zoom = "1";
      if (!overflows()) return;
      // The largest zoom that fits: a few halvings between too small and too big
      let low = MIN_ZOOM;
      let high = 1;
      for (let i = 0; i < 7; i++) {
        const mid = (low + high) / 2;
        content.style.zoom = String(mid);
        if (overflows()) high = mid;
        else low = mid;
      }
      content.style.zoom = String(low);
    };
    // Hidden overflow can still be scrolled by the browser (focus, find in page): the
    // content always starts at the top
    const toTop = () => {
      if (box.scrollTop) box.scrollTop = 0;
    };
    box.addEventListener("scroll", toTop);
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    // The room changes (window, rotation) or the size of the content does (data
    // loaded, a tab): text changing within the same size needs nothing
    const observer = new ResizeObserver(later);
    observer.observe(box);
    observer.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      box.removeEventListener("scroll", toTop);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={outer} className={styles.box}>
      <div ref={inner} className={`${styles.content} ${className ?? ""}`}>
        {children}
      </div>
    </div>
  );
};

export default FitToScreen;
