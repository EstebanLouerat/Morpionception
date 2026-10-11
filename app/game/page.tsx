"use client";

import { useState } from "react";
import LocalGame from "./LocalGame";
import OnlineGame from "./OnlineGame";
import { cleanCode } from "../online/protocol";

// /game?mode=… is played on this device, /game?room=CODE online in that room
export default function Game() {
  const [room] = useState(() =>
    cleanCode(new URLSearchParams(window.location.search).get("room") ?? "")
  );
  return room ? <OnlineGame code={room} /> : <LocalGame />;
}
