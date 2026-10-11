"use client";
import Link from "next/link";
import { ButtonHTMLAttributes, ComponentProps, MouseEvent } from "react";
import styles from "./Button.module.css";
import Icon, { IconName } from "./Icon";
import { Fx, playFx } from "../audio/engine";

type Variant = "primary" | "secondary";
type Size = "sm" | "md" | "lg";

type StyleProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: IconName;
  /** Sound played on click, false for none */
  sound?: Fx | false;
};

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ");

const btnClass = (
  { variant = "primary", size = "md", fullWidth }: StyleProps,
  className?: string
) => cx(styles.btn, styles[variant], styles[size], fullWidth && styles.full, className);

const withSound = <E,>(sound: Fx | false, onClick?: (e: E) => void) =>
  (e: E) => {
    if (sound) playFx(sound);
    onClick?.(e);
  };

/** 3D push button */
export const Button = ({
  variant,
  size,
  fullWidth,
  icon,
  sound = "click",
  className,
  children,
  onClick,
  ...rest
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={btnClass({ variant, size, fullWidth }, className)}
    onClick={withSound<MouseEvent<HTMLButtonElement>>(sound, onClick)}
    {...rest}
  >
    <span className={styles.face}>
      {icon && <Icon name={icon} size={size === "lg" ? 28 : 20} />}
      {children}
    </span>
  </button>
);

/** Same look as Button, for navigation */
export const ButtonLink = ({
  variant,
  size,
  fullWidth,
  icon,
  sound = "click",
  className,
  children,
  onClick,
  ...rest
}: StyleProps & ComponentProps<typeof Link>) => (
  <Link
    className={btnClass({ variant, size, fullWidth }, className)}
    onClick={withSound<MouseEvent<HTMLAnchorElement>>(sound, onClick)}
    {...rest}
  >
    <span className={styles.face}>
      {icon && <Icon name={icon} size={size === "lg" ? 28 : 20} />}
      {children}
    </span>
  </Link>
);

type IconButtonProps = { icon: IconName; label: string; className?: string };

/** Round icon-only button, as a link */
export const IconLink = ({
  icon,
  label,
  className,
  onClick,
  ...rest
}: IconButtonProps & Omit<ComponentProps<typeof Link>, "children">) => (
  <Link
    className={cx(styles.iconBtn, className)}
    aria-label={label}
    title={label}
    onClick={withSound<MouseEvent<HTMLAnchorElement>>("click", onClick)}
    {...rest}
  >
    <Icon name={icon} />
  </Link>
);
