"use client";

import { useRouter } from "next/navigation";
import styles from "./Home.module.css";

export default function Home() {
  const router = useRouter();

  return (
    <main className={styles.container}>
      <div className={styles.animatedBackground} aria-hidden="true" />
      <h1 className={styles.title}>
        Morpion<span>ception</span>
      </h1>
      <div className={styles.btnContainer}>
        <button className={styles.btn} onClick={() => router.push("/game")}>
          <span className={styles.btnTop}>Jouer</span>
        </button>
        <button className={styles.btn}>
          <span className={styles.btnTop}>Paramètre</span>
        </button>
      </div>
    </main>
  );
}
