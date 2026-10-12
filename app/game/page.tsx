"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import LocalGame from "./LocalGame";
import OnlineGame from "./OnlineGame";
import { cleanCode } from "../online/protocol";

// /game?mode=… is played on this device, /game?room=CODE online in that room
export default function Game() {
  const params = useSearchParams();
  const [room] = useState(() => cleanCode(params.get("room") ?? ""));
  return room ? <OnlineGame code={room} /> : <LocalGame />;
}
