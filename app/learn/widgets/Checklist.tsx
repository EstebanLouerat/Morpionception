"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import styles from "./Widgets.module.css";
import Icon from "../../ui/Icon";
import { playFx } from "../../audio/engine";
import { markSolved } from "../progress";

/** The questions to ask before each move, ticked one by one */
const Checklist = ({ id, items }: { id: string; items: { title: string; text: string }[] }) => {
  const [ticked, setTicked] = useState<boolean[]>(() => items.map(() => false));
  const all = ticked.every(Boolean);
  return (
    <div className={styles.widget}>
      <ol className={styles.checklist}>
        {items.map((item, i) => (
          <motion.li
            key={item.title}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
          >
            <button
              type="button"
              className={`${styles.check} ${ticked[i] ? styles.ticked : ""}`}
              aria-pressed={ticked[i]}
              onClick={() => {
                const next = ticked.map((t, k) => (k === i ? !t : t));
                setTicked(next);
                playFx("select");
                if (next.every(Boolean)) markSolved(id);
              }}
            >
              <span className={styles.box} aria-hidden="true">
                {ticked[i] && <Icon name="check" size={16} />}
              </span>
              <span>
                <b>
                  {i + 1}. {item.title}
                </b>
                <small>{item.text}</small>
              </span>
            </button>
          </motion.li>
        ))}
      </ol>
      <p className={`${styles.caption} ${all ? styles.success : ""}`} role="status" aria-live="polite">
        {all ? "Tu as la méthode. Maintenant, joue !" : `${ticked.filter(Boolean).length} / ${items.length}`}
      </p>
    </div>
  );
};

export default Checklist;
