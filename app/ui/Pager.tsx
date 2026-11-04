"use client";

import { useEffect, useState } from "react";
import styles from "./Pager.module.css";
import Icon from "./Icon";

/** One page of a list (pages of `size` items) and the controls to move between them */
export const usePages = <T,>(items: T[], size: number, start = 0) => {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const [page, setPage] = useState(start);
  // Fewer pages than before (a smaller screen, a shorter list): stay on a real one
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);
  const current = Math.min(page, pages - 1);
  return {
    items: items.slice(current * size, current * size + size),
    page: current,
    pages,
    setPage,
  };
};

type PagerProps = { page: number; pages: number; onChange: (page: number) => void; label: string };

/** "‹ 2 / 4 ›" under a list shown page by page (nothing when it fits on one page) */
const Pager = ({ page, pages, onChange, label }: PagerProps) =>
  pages <= 1 ? null : (
    <nav className={styles.pager} aria-label={label}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        aria-label="Page précédente"
      >
        <Icon name="chevronLeft" size={20} />
      </button>
      <span className={styles.count} aria-live="polite">
        {page + 1} / {pages}
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={() => onChange(page + 1)}
        disabled={page === pages - 1}
        aria-label="Page suivante"
      >
        <Icon name="chevronRight" size={20} />
      </button>
    </nav>
  );

export default Pager;
