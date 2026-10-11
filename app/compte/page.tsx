"use client";

import styles from "./Compte.module.css";
import ui from "../ui/common.module.css";
import PageShell from "../ui/PageShell";
import Icon from "../ui/Icon";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";

const STATS = [
  { label: "Parties", value: "—" },
  { label: "Victoires", value: "—" },
  { label: "Classement", value: "—" },
];

// Placeholder page: accounts need a backend (auth + database), not built yet
export default function Compte() {
  return (
    <PageShell title="Compte">
      <section className={ui.card}>
        <div className={styles.profile}>
          <span className={styles.avatar}>
            <Icon name="user" size={40} />
          </span>
          <div>
            <strong className={styles.name}>Invité</strong>
            <p className={ui.muted}>
              Crée un compte pour sauvegarder ta progression, ajouter des amis et
              jouer en classé.
            </p>
          </div>
        </div>
        <div className={ui.row}>
          <Button icon="user" disabled>
            Se connecter
          </Button>
          <Button variant="secondary" icon="userPlus" disabled>
            Créer un compte
          </Button>
        </div>
      </section>

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>
          Statistiques <Badge />
        </h2>
        <div className={styles.stats}>
          {STATS.map((s) => (
            <div key={s.label} className={styles.stat}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>
          Profil <Badge />
        </h2>
        <div className={ui.card}>
          <label className={styles.fieldLabel} htmlFor="pseudo">
            Pseudo
          </label>
          <input id="pseudo" className={ui.input} placeholder="Ton pseudo" disabled />
          <p className={ui.muted}>Avatar, pseudo et pions personnalisés arrivent bientôt.</p>
        </div>
      </section>
    </PageShell>
  );
}
