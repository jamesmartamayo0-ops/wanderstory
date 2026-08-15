"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/theme";

export default function AdminThemeLock() {
  useEffect(() => {
    applyTheme("light");
  }, []);

  return null;
}