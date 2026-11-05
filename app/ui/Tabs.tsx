"use client";

import { ReactNode, useId, useState } from "react";
import styles from "./Tabs.module.css";
import { playFx } from "../audio/engine";

export type Tab = { id: string; label: string; content: ReactNode };

type TabsProps = {
  label: string;
  tabs: Tab[];
  /** On wide screens, every panel side by side instead of tabs */
  allOnWide?: boolean;
  initial?: string;
};

/** Panels shown one at a time, so a page fits on a small screen without scrolling */
const Tabs = ({ label, tabs, allOnWide = false, initial }: TabsProps) => {
  const [active, setActive] = useState(() =>
    tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id
  );
  const base = useId();
  const select = (id: string) => {
    if (id === active) return;
    playFx("select");
    setActive(id);
  };
  // Arrow keys move between tabs (WAI-ARIA tabs pattern)
  const onKey = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    select(next.id);
    document.getElementById(`${base}-tab-${next.id}`)?.focus();
  };
  return (
    <div className={`${styles.tabs} ${allOnWide ? styles.allOnWide : ""}`}>
      <div className={styles.list} role="tablist" aria-label={label}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            id={`${base}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            className={styles.tab}
            onClick={() => select(tab.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.panels}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`${base}-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${base}-tab-${tab.id}`}
            className={`${styles.panel} ${tab.id === active ? "" : styles.inactive}`}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tabs;
