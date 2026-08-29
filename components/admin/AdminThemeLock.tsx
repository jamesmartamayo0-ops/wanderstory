"use client";

import { useLayoutEffect } from "react";
import { applyTheme } from "@/lib/theme";

export default function AdminThemeLock() {
  useLayoutEffect(() => {
    applyTheme("light");
  }, []);

  return null;
}
