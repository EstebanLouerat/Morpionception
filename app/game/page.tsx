"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import AiGame from "./AiGame";
import LocalGame from "./LocalGame";
import OnlineGame from "./OnlineGame";
import { cleanCode } from "../online/protocol";

// /game?mode=… is played on this device (mode=ai against the AI),
// /game?room=CODE online in that room
export default function Game() {
  const params = useSearchParams();
  const [room] = useState(() => cleanCode(params.get("room") ?? ""));
  const [vsAi] = useState(() => params.get("mode") === "ai");
  if (room) return <OnlineGame code={room} />;
  return vsAi ? <AiGame /> : <LocalGame />;
}
