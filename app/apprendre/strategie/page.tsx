"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../Learn.module.css";
import book from "./Strategie.module.css";
import PageShell from "../../ui/PageShell";
import Dialog from "../../ui/Dialog";
import Icon from "../../ui/Icon";
import { Button, IconButton } from "../../ui/Button";
import { LESSONS, LEVELS, lessonById, type Lesson, type Level } from "../../learn/book";
import { markRead, useLearnProgress } from "../../learn/progress";
import SendDemo from "../../learn/widgets/SendDemo";
import LinesDemo from "../../learn/widgets/LinesDemo";
import PuzzleView from "../../learn/widgets/PuzzleView";
import ReplayView from "../../learn/widgets/ReplayView";
import Checklist from "../../learn/widgets/Checklist";

const Widget = ({ lesson }: { lesson: Lesson }) => {
  const w = lesson.widget;
  switch (w.kind) {
    case "send":
      return <SendDemo />;
    case "lines":
      return <LinesDemo scale={w.scale} />;
    case "puzzle":
      return <PuzzleView id={lesson.id} puzzle={w.puzzle} />;
    case "replay":
      return <ReplayView start={w.start} moves={w.moves} captions={w.captions} />;
    case "checklist":
      return <Checklist id={lesson.id} items={w.items} />;
  }
};

/** The strategy book: one lesson at a time (?lecon=…), simple to advanced, each with
 * something to try: a demo, a puzzle, a commented game */
export default function Strategie() {
  const router = useRouter();
  const params = useSearchParams();
  const lesson = lessonById(params.get("lecon")) ?? LESSONS[0];
  const index = LESSONS.indexOf(lesson);
  const [contents, setContents] = useState(false);
  const progress = useLearnProgress();

  useEffect(() => markRead(lesson.id), [lesson.id]);
  const go = (to: Lesson) => router.replace(`/apprendre/strategie?lecon=${to.id}`, { scroll: false });
  const inLevel = LESSONS.filter((l) => l.level === lesson.level);

  return (
    <PageShell
      title="Stratégie"
      backHref="/apprendre"
      wide
      actions={<IconButton icon="book" label="Sommaire" onClick={() => setContents(true)} />}
    >
      <Contents open={contents} onClose={() => setContents(false)} current={lesson} onPick={go} progress={progress} />
      {/* A fresh widget for each lesson */}
      <div className={styles.stage} key={lesson.id}>
        <div className={styles.words}>
          <span className={styles.kicker}>
            {LEVELS[lesson.level]} · {inLevel.indexOf(lesson) + 1}/{inLevel.length}
          </span>
          <h2 className={styles.title}>{lesson.title}</h2>
          {lesson.text.map((p) => (
            <p key={p} className={styles.text}>
              {p}
            </p>
          ))}
          <div className={styles.dots} aria-label={`Leçon ${index + 1} sur ${LESSONS.length}`}>
            {LESSONS.map((l, i) => (
              <span key={l.id} className={i < index ? styles.done : i === index ? styles.now : ""} />
            ))}
          </div>
        </div>
        <Widget lesson={lesson} />
      </div>
      <div className={styles.nav}>
        <Button variant="secondary" icon="chevronLeft" disabled={index === 0} onClick={() => go(LESSONS[index - 1])}>
          Précédente
        </Button>
        <Button
          icon="chevronRight"
          disabled={index === LESSONS.length - 1}
          onClick={() => go(LESSONS[index + 1])}
        >
          Suivante
        </Button>
      </div>
    </PageShell>
  );
}

type ContentsProps = {
  open: boolean;
  onClose: () => void;
  current: Lesson;
  onPick: (lesson: Lesson) => void;
  progress: { read: string[]; solved: string[] };
};

/** Every lesson by level, with what was read or solved */
const Contents = ({ open, onClose, current, onPick, progress }: ContentsProps) => (
  <Dialog open={open} title="Sommaire" onClose={onClose}>
    {(Object.keys(LEVELS) as Level[]).map((level) => (
      <section key={level} className={book.level}>
        <h3>{LEVELS[level]}</h3>
        <ol>
          {LESSONS.filter((l) => l.level === level).map((lesson) => {
            const solved = progress.solved.includes(lesson.id);
            const read = progress.read.includes(lesson.id);
            return (
              <li key={lesson.id}>
                <button
                  type="button"
                  className={`${book.entry} ${lesson.id === current.id ? book.current : ""}`}
                  onClick={() => {
                    onPick(lesson);
                    onClose();
                  }}
                >
                  <span className={`${book.state} ${solved ? book.solved : read ? book.read : ""}`} aria-hidden="true">
                    {solved || read ? <Icon name="check" size={14} /> : null}
                  </span>
                  <span className={book.entryTitle}>{lesson.title}</span>
                  <small>{kindLabel(lesson)}</small>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    ))}
  </Dialog>
);

const kindLabel = (lesson: Lesson) =>
  ({ send: "démo", lines: "démo", puzzle: "énigme", replay: "partie commentée", checklist: "méthode" })[
    lesson.widget.kind
  ];
