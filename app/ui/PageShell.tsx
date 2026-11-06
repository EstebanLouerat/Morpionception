"use client";
import { ReactNode } from "react";
import styles from "./PageShell.module.css";
import { IconLink } from "./Button";
import FitToScreen from "./FitToScreen";

type PageShellProps = {
  title: string;
  backHref?: string;
  /** Optional buttons on the right of the top bar */
  actions?: ReactNode;
  /** Wider content, for pages laid out in columns on large screens */
  wide?: boolean;
  /** A list that grows (the Jouer menu): it scrolls under the top bar at its natural
   * size, instead of being shrunk to fit the screen */
  scroll?: boolean;
  children: ReactNode;
};

/** Layout of the menu pages: top bar with back button, then the content, one screen
 * tall: the content is shrunk to fit it (FitToScreen), or scrolls for a long list */
const PageShell = ({ title, backHref = "/", actions, wide, scroll, children }: PageShellProps) => (
  <div className={styles.page}>
    <header className={`${styles.bar} ${wide ? styles.wide : ""}`}>
      <IconLink href={backHref} icon="arrowLeft" label="Retour" />
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.actions}>{actions}</div>
    </header>
    <main className={`${styles.content} ${wide ? styles.wide : ""} ${scroll ? styles.scroll : ""}`}>
      {scroll ? <div className={styles.scrolled}>{children}</div> : <FitToScreen>{children}</FitToScreen>}
    </main>
  </div>
);

export default PageShell;
