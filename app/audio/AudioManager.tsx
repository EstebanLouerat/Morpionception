"use client";
import { useEffect } from "react";
import { initAudio } from "./engine";

// Mounted once in the root layout so the music keeps playing across pages
const AudioManager = () => {
  useEffect(() => initAudio(), []);
  return null;
};

export default AudioManager;
