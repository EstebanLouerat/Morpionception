"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import styles from "./SearchPill.module.css";
import Icon from "../ui/Icon";
import { formatWait } from "./client";

/** On every page while a ranked search goes on: how long it has been, a way back to
 * the ranked page, and a way to stop it */
const SearchPill = ({ startedAt, onCancel }: { startedAt: number; onCancel: () => void }) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  return (
    <motion.div
      className={styles.pill}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      role="status"
    >
      <Link href="/jouer/classe" className={styles.body}>
        <span className={styles.radar} aria-hidden="true">
          <span />
          <span />
        </span>
        <span className={styles.text}>
          <strong>Recherche classée</strong>
          <small>{formatWait(now - (startedAt || now))}</small>
        </span>
      </Link>
      <button type="button" className={styles.cancel} onClick={onCancel} aria-label="Annuler la recherche">
        <Icon name="close" size={18} />
      </button>
    </motion.div>
  );
};

export default SearchPill;
