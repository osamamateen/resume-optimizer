"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/authFetch";
import type { UsageSummary } from "@/lib/services/usage.service";

interface UseUsageResult {
  usage: UsageSummary | null;
  loaded: boolean;
  reload: () => void;
}

export function useUsage(enabled: boolean): UseUsageResult {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    if (!enabled) return;
    authFetch("/api/usage")
      .then(async (res) => {
        if (res.ok) {
          setUsage(await res.json());
        } else {
          setUsage(null);
        }
      })
      .catch(() => setUsage(null))
      .finally(() => setLoaded(true));
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { usage, loaded, reload };
}
