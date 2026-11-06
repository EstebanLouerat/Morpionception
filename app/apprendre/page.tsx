"use client";

import Link from "next/link";
import styles from "../jouer/Jouer.module.css";
import ui from "../ui/common.module.css";
import PageShell from "../ui/PageShell";
import Icon from "../ui/Icon";
import { playFx } from "../audio/engine";
import { LESSONS, isExercise } from "../learn/book";
import { useLearnProgress } from "../learn/progress";

/** Learning, opened by the player only: the tutorial and the strategy book */
export default function Apprendre() {
  const progress = useLearnProgress();
  const read = LESSONS.filter((l) => progress.read.includes(l.id)).length;
  const exercises = LESSONS.filter(isExercise);
  const solved = exercises.filter((l) => progress.solved.includes(l.id)).length;
  const cards = [
    {
      href: "/apprendre/tutoriel",
      icon: "school" as const,
      title: "Tutoriel",
      text: progress.tutorialDone
        ? "Terminé. Les règles en jouant, à refaire quand tu veux."
        : "Les règles en jouant, en 3 minutes.",
    },
    {
      href: "/apprendre/strategie",
      icon: "book" as const,
      title: "Le livre de stratégie",
      text: `${LESSONS.length} leçons, du débutant à l'expert : démos, énigmes, partie commentée. ${
        read ? `${read}/${LESSONS.length} lues · ${solved}/${exercises.length} exercices réussis.` : ""
      }`,
    },
  ];
  return (
    <PageShell title="Apprendre" backHref="/">
      <section className={ui.section}>
        <div className={styles.grid}>
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className={styles.card} onClick={() => playFx("click")}>
              <span className={styles.icon}>
                <Icon name={card.icon} size={26} />
              </span>
              <span className={styles.text}>
                <strong>{card.title}</strong>
                <small>{card.text}</small>
              </span>
              <Icon name="chevronRight" className={styles.chevron} />
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
