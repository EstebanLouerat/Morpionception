import { CSSProperties } from "react";
import styles from "./Avatar.module.css";
import { avatarEmoji, colorValue, type AvatarId, type ColorId } from "./profile";

type AvatarProps = {
  avatar: AvatarId;
  color: ColorId;
  /** Diameter in pixels */
  size?: number;
  className?: string;
};

/** Profile picture: the avatar emoji on its color */
const Avatar = ({ avatar, color, size = 40, className }: AvatarProps) => (
  <span
    className={`${styles.avatar} ${className ?? ""}`}
    style={{ "--avatar-bg": colorValue(color), "--avatar-size": `${size}px` } as CSSProperties}
    aria-hidden="true"
  >
    {avatarEmoji(avatar)}
  </span>
);

export default Avatar;
