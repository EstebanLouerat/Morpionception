import { ReactNode } from "react";
import ui from "./common.module.css";
import Icon from "./Icon";

/** Marks a feature that is planned but not available yet */
const Badge = ({ children = "Bientôt" }: { children?: ReactNode }) => (
  <span className={ui.badge}>
    <Icon name="lock" size={12} />
    {children}
  </span>
);

export default Badge;
