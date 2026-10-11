"use client";
import { ReactNode } from "react";
import styles from "./PageShell.module.css";
import { IconLink } from "./Button";

type PageShellProps = {
  title: string;
  backHref?: string;
  /** Optional buttons on the right of the top bar */
  actions?: ReactNode;
  children: ReactNode;
};

/** Layout of the menu pages: top bar with back button, then centered content */
const PageShell = ({ title, backHref = "/", actions, children }: PageShellProps) => (
  <div className={styles.page}>
    <header className={styles.bar}>
      <IconLink href={backHref} icon="arrowLeft" label="Retour" />
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.actions}>{actions}</div>
    </header>
    <main className={styles.content}>{children}</main>
  </div>
);

export default PageShell;
