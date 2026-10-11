"use client";

import styles from "./Home.module.css";
import { ButtonLink, IconLink } from "./ui/Button";

export default function Home() {
  return (
    <main className={styles.container}>
      <div className={styles.animatedBackground} aria-hidden="true" />

      <header className={styles.topBar}>
        <IconLink href="/compte" icon="user" label="Compte" />
        <div className={styles.topBarRight}>
          <IconLink href="/amis" icon="users" label="Amis" />
          <IconLink href="/parametres" icon="gear" label="Paramètres" />
        </div>
      </header>

      <div className={styles.hero}>
        <h1 className={styles.title}>
          Morpion<span>ception</span>
        </h1>
        <p className={styles.tagline}>Le morpion… dans un morpion.</p>
      </div>

      <nav className={styles.menu}>
        <ButtonLink href="/jouer" size="lg" icon="play" fullWidth>
          Jouer
        </ButtonLink>
        <ButtonLink href="/jouer/ami" variant="secondary" icon="userPlus" fullWidth>
          Jouer avec un ami
        </ButtonLink>
      </nav>
    </main>
  );
}
