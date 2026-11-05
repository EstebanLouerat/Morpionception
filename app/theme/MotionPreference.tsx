"use client";

import { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { useAppearance } from "./appearance";

/** framer-motion animations follow the "Réduire les animations" setting (and the
 * system's) */
const MotionPreference = ({ children }: { children: ReactNode }) => {
  const { reduceMotion } = useAppearance();
  return <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>{children}</MotionConfig>;
};

export default MotionPreference;
