"use client";

import styles from "./Home.module.css";
import { ButtonLink, IconLink } from "./ui/Button";
import AccountLink from "./account/AccountLink";
import HomeBackground from "./home/HomeBackground";

export default function Home() {
  return (
    <main className={styles.container}>
      <HomeBackground />

      <header className={styles.topBar}>
        <AccountLink />
        <div className={styles.topBarRight}>
          <IconLink href="/classement" icon="trophy" label="Classement" />
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
        {/* Learning is only ever opened from here (or the Jouer menu), never by itself */}
        <ButtonLink href="/apprendre" variant="secondary" icon="school" fullWidth>
          Apprendre à jouer
        </ButtonLink>
      </nav>
    </main>
  );
}
