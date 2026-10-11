"use client";

import { useState } from "react";
import styles from "./Ami.module.css";
import ui from "../../ui/common.module.css";
import PageShell from "../../ui/PageShell";
import Icon from "../../ui/Icon";
import Badge from "../../ui/Badge";
import { Button } from "../../ui/Button";

const CODE_LENGTH = 6;
const cleanCode = (raw: string) =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);

// Placeholder page: rooms need a server, which does not exist yet.
// Invite links will look like /jouer/ami?code=ABC123 (the code is prefilled).
export default function JouerAmi() {
  const [code, setCode] = useState(() =>
    typeof window === "undefined"
      ? ""
      : cleanCode(new URLSearchParams(window.location.search).get("code") ?? "")
  );

  return (
    <PageShell title="Avec un ami" backHref="/jouer">
      <p className={ui.muted}>
        Bientôt, tu pourras créer un salon et inviter un ami à jouer en ligne, où
        qu&apos;il soit.
      </p>

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>
          Inviter un ami <Badge />
        </h2>
        <div className={ui.card}>
          <div className={styles.invite}>
            <div className={styles.qr} aria-label="QR code du salon (bientôt)">
              <Icon name="qr" size={56} />
              <span>QR code</span>
            </div>
            <div className={styles.roomInfo}>
              <span className={styles.label}>Code du salon</span>
              <span className={styles.roomCode} aria-label="Aucun code pour l'instant">
                {"—".repeat(CODE_LENGTH)}
              </span>
              <span className={ui.muted}>
                Ton ami scanne le QR code, ouvre le lien ou entre ce code.
              </span>
            </div>
          </div>

          <div className={ui.row}>
            <Button variant="secondary" size="sm" icon="copy" disabled>
              Copier le lien
            </Button>
            <Button variant="secondary" size="sm" icon="share" disabled>
              Partager
            </Button>
          </div>
          <Button icon="play" fullWidth disabled>
            Créer un salon
          </Button>
        </div>
      </section>

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>
          Rejoindre une partie <Badge />
        </h2>
        <form
          className={ui.card}
          onSubmit={(e) => e.preventDefault()}
        >
          <label className={styles.label} htmlFor="room-code">
            Code du salon
          </label>
          <input
            id="room-code"
            className={`${ui.input} ${styles.codeInput}`}
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={CODE_LENGTH}
          />
          <Button type="submit" icon="link" fullWidth disabled>
            Rejoindre
          </Button>
        </form>
      </section>
    </PageShell>
  );
}
