"use client";
import React, { Suspense, useEffect } from "react";
import Loader from "./ui/Loader";

interface IProp {
  children: React.ReactNode;
}

// Pages rely on localStorage, so they render on the client only.
// Until then (and while the JS loads) the loader is shown.
// Pages read the query string with useSearchParams, which needs a Suspense boundary.
const RouterMounting = ({ children }: IProp) => {
  const [mounted, setMounted] = React.useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <Loader fullscreen />;
  return <Suspense fallback={<Loader fullscreen />}>{children}</Suspense>;
};

export default RouterMounting;
