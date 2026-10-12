"use client";

import styles from "./Amis.module.css";
import ui from "../ui/common.module.css";
import PageShell from "../ui/PageShell";
import Icon from "../ui/Icon";
import Badge from "../ui/Badge";
import { ButtonLink } from "../ui/Button";

// Placeholder page: friends (on top of the accounts) are not built yet
export default function Amis() {
  return (
    <PageShell title="Amis">
      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>
          Ajouter un ami <Badge />
        </h2>
        <div className={styles.search}>
          <Icon name="search" size={20} className={styles.searchIcon} />
          <input
            className={`${ui.input} ${styles.searchInput}`}
            placeholder="Rechercher un joueur…"
            aria-label="Rechercher un joueur"
            disabled
          />
        </div>
      </section>

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Mes amis</h2>
        <div className={`${ui.card} ${styles.empty}`}>
          <span className={styles.emptyIcon}>
            <Icon name="users" size={40} />
          </span>
          <strong>Pas encore d&apos;amis</strong>
          <p className={ui.muted}>
            Liste d&apos;amis, demandes, statut en ligne et défis arrivent bientôt. En
            attendant, invite un ami à jouer !
          </p>
          <ButtonLink href="/jouer/ami" icon="userPlus" size="sm">
            Inviter un ami
          </ButtonLink>
        </div>
      </section>
    </PageShell>
  );
}
