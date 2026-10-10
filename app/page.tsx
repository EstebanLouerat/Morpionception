"use client";

import { useRouter } from "next/navigation";
import styles from "./Home.module.css";
import { playFx } from "./audio/engine";

export default function Home() {
  const router = useRouter();

  const goTo = (path: string) => {
    playFx("click");
    router.push(path);
  };

  return (
    <main className={styles.container}>
      <div className={styles.animatedBackground} aria-hidden="true" />
      <h1 className={styles.title}>
        Morpion<span>ception</span>
      </h1>
      <div className={styles.btnContainer}>
        <button className={styles.btn} onClick={() => goTo("/game")}>
          <span className={styles.btnTop}>Jouer</span>
        </button>
        <button className={styles.btn} onClick={() => goTo("/parametres")}>
          <span className={styles.btnTop}>Paramètres</span>
        </button>
      </div>
    </main>
  );
}
