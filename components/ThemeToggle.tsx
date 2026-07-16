"use client";

import { useSyncExternalStore } from "react";
import { IconSun, IconMoon } from "@tabler/icons-react";
import { getThemeSnapshot, getServerThemeSnapshot, subscribeTheme, setTheme } from "@/lib/theme/themeStore";

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  return (
    <button
      type="button"
      onClick={() => setTheme(!dark)}
      aria-label="Toggle dark mode"
      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {dark ? <IconMoon size={16} /> : <IconSun size={16} />}
    </button>
  );
}
