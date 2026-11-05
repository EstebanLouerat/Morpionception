"use client";

import { ReactNode, useLayoutEffect, useRef } from "react";
import styles from "./FitToScreen.module.css";

// Below this, text would be too small to read: the page has to be laid out to need less
const MIN_SCALE = 0.55;
// Changes smaller than this are not applied (no back and forth between two values)
const STEP = 0.004;

/** Shows its content without scrolling: when it is taller than the room it has, it is
 * laid out wider and scaled down (CSS transform) by just as much as needed, so it keeps
 * the full width and its text reflows. Only layout sizes are measured (offsetHeight,
 * clientWidth), which every browser reports the same way, transform or not. Pages are
 * laid out to fit; this absorbs the last few lines on small screens. */
const FitToScreen = ({ children, className }: { children: ReactNode; className?: string }) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = outer.current!;
    const content = inner.current!;
    // Its width and scale change at once, whatever transitions the site sets: the
    // measures below must read the new layout, not a transition's first frame
    content.style.setProperty("transition", "none", "important");
    let frame = 0;
    let scale = 1;

    /** Height of the content laid out for this scale (its width grows as it shrinks) */
    const heightAt = (s: number, width: number) => {
      // Measured without the margin of an earlier fit: with an automatic width, a
      // negative margin would make the content wider, so shorter, than it really is
      content.style.marginRight = "";
      content.style.width = s === 1 ? "" : `${width / s}px`;
      return content.offsetHeight;
    };
    const apply = (s: number, width: number) => {
      heightAt(s, width);
      content.style.transform = s === 1 ? "" : `scale(${s})`;
      // Laid out wider, it still takes only the box's width: a container sized by its
      // content (the end of game modal) does not grow with it
      content.style.marginRight = s === 1 ? "" : `${width - width / s}px`;
      const changed = s !== scale;
      content.dataset.scale = String(s);
      scale = s;
      // Pages that measure their layout (the leaderboard) measure again
      if (changed) content.dispatchEvent(new Event("fitscale", { bubbles: true }));
    };
    const fit = () => {
      box.scrollTop = 0;
      const room = box.clientHeight;
      const width = box.clientWidth;
      if (!room || !width) return;
      let next = 1;
      if (heightAt(1, width) > room + 1) {
        // The largest scale that fits: a few halvings between too small and too big
        let low = MIN_SCALE;
        let high = 1;
        for (let i = 0; i < 8; i++) {
          const mid = (low + high) / 2;
          if (heightAt(mid, width) * mid <= room) low = mid;
          else high = mid;
        }
        next = low;
      }
      // Same result as before: leave it (the measures above restored nothing visible)
      apply(Math.abs(next - scale) < STEP ? scale : next, width);
    };
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    // Hidden overflow can still be scrolled by the browser (focus, find in page): the
    // content always starts at the top
    const toTop = () => {
      if (box.scrollTop) box.scrollTop = 0;
    };
    box.addEventListener("scroll", toTop);
    fit();
    // The room changes (window, rotation) or the size of the content does (data
    // loaded, a tab). The content's own width changes when it is fitted: the next fit
    // finds the same scale and changes nothing, so this never loops.
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
