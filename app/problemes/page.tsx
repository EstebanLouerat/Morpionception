"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./Problemes.module.css";
import ui from "../ui/common.module.css";
import PageShell from "../ui/PageShell";
import Icon from "../ui/Icon";
import { playFx } from "../audio/engine";
import { LEVELS, PROBLEMS, levelLabel, nextProblem, problemById } from "../problems/data";
import { useProblemProgress } from "../problems/progress";
import ProblemView from "./ProblemView";

/** Problems: the levels and the progress made (?id=… opens one) */
export default function Problemes() {
  const router = useRouter();
  const params = useSearchParams();
  const progress = useProblemProgress();
  const problem = problemById(params.get("id"));

  if (problem) {
    const next = nextProblem(problem.level, progress.results, problem.id);
    const here = PROBLEMS.filter((p) => p.level === problem.level);
    return (
      <PageShell
        title={`Problème ${here.indexOf(problem) + 1}/${here.length}`}
        backHref="/problemes"
        wide
      >
        {/* A fresh board for each problem */}
        <ProblemView
          key={problem.id}
          problem={problem}
          onNext={next && next.id !== problem.id ? () => router.replace(`/problemes?id=${next.id}`) : null}
        />
      </PageShell>
    );
  }

  const solved = Object.values(progress.results).filter((r) => r !== "failed").length;
  return (
    <PageShell title="Problèmes" backHref="/jouer">
      <section className={ui.section}>
        <p className={ui.muted}>
          Des positions tirées de vraies parties. Trouve le coup du moteur, ou gagne de force coup après coup : chaque
          coup est expliqué, juste ou faux.
        </p>
        <div className={styles.stats}>
          <span>
            <b>{solved}</b>/{PROBLEMS.length} résolus
          </span>
          <span>
            Série <b>{progress.streak}</b> · record <b>{progress.bestStreak}</b>
          </span>
        </div>
      </section>
      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Niveaux</h2>
        <ul className={styles.levels}>
          {LEVELS.map((level) => {
            const here = PROBLEMS.filter((p) => p.level === level.id);
            const done = here.filter((p) => progress.results[p.id] && progress.results[p.id] !== "failed").length;
            const tried = here.filter((p) => progress.results[p.id]).length;
            // The next problem not tried yet, or the first again once all are
            const target = nextProblem(level.id, progress.results) ?? here[0];
            return (
              <li key={level.id}>
                <Link
                  href={target ? `/problemes?id=${target.id}` : "/problemes"}
                  className={styles.level}
                  onClick={() => playFx("click")}
                  aria-label={`${level.label} : ${done} sur ${here.length} résolus`}
                >
                  <span className={styles.levelText}>
                    <strong>{level.label}</strong>
                    <small>{level.hint}</small>
                  </span>
                  <span className={styles.levelCount}>
                    {done}/{here.length}
                  </span>
                  <Icon name="chevronRight" className={styles.chevron} />
                  <span className={styles.bar} aria-hidden="true">
                    <span style={{ width: `${(tried / Math.max(1, here.length)) * 100}%` }} className={styles.barTried} />
                    <span style={{ width: `${(done / Math.max(1, here.length)) * 100}%` }} className={styles.barDone} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <p className={styles.legend}>
        <b>Victoire forcée</b> : joue chaque coup de la ligne gagnante, l&apos;adversaire se défend au mieux.{" "}
        <b>Meilleur coup</b> : trouve le coup du moteur. {levelLabel("facile")} à {levelLabel("expert")} : de plus en plus
        de calcul pour le trouver.
      </p>
    </PageShell>
  );
}
