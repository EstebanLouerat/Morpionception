"use client";

import Link from "next/link";
import styles from "./Jouer.module.css";
import ui from "../ui/common.module.css";
import PageShell from "../ui/PageShell";
import Icon from "../ui/Icon";
import Badge from "../ui/Badge";
import { MODES, hasOptions } from "../game/modes";
import { playFx } from "../audio/engine";

export default function Jouer() {
  return (
    <PageShell title="Jouer">
      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Modes de jeu</h2>
        <div className={styles.grid}>
          {MODES.map((mode) => {
            const content = (
              <>
                <span className={styles.icon}>
                  <Icon name={mode.icon} size={26} />
                </span>
                <span className={styles.text}>
                  <strong>{mode.name}</strong>
                  <small>{mode.tagline}</small>
                </span>
                {mode.available ? (
                  <Icon name="chevronRight" className={styles.chevron} />
                ) : (
                  <Badge />
                )}
              </>
            );
            return mode.available ? (
              <Link
                key={mode.id}
                // Modes with options go through the options screen first
                href={
                  hasOptions(mode) ? `/jouer/partie?mode=${mode.id}` : `/game?mode=${mode.id}`
                }
                className={styles.card}
                onClick={() => playFx("click")}
              >
                {content}
              </Link>
            ) : (
              <div
                key={mode.id}
                className={`${styles.card} ${styles.disabled}`}
                aria-disabled="true"
              >
                {content}
              </div>
            );
          })}
        </div>
      </section>

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>En ligne</h2>
        <Link href="/jouer/ami" className={styles.card} onClick={() => playFx("click")}>
          <span className={styles.icon}>
            <Icon name="userPlus" size={26} />
          </span>
          <span className={styles.text}>
            <strong>Avec un ami</strong>
            <small>Invite-le avec un lien, un code de salon ou un QR code.</small>
          </span>
          <Icon name="chevronRight" className={styles.chevron} />
        </Link>
      </section>
    </PageShell>
  );
}
