"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/authFetch";

interface UseMasterResumeResult {
  fileName: string | null;
  loaded: boolean;
  reload: () => void;
}

export function useMasterResume(enabled: boolean): UseMasterResumeResult {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    if (!enabled) return;
    authFetch("/api/master-resume")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setFileName(data.fileName);
        } else {
          setFileName(null);
        }
      })
      .catch(() => setFileName(null))
      .finally(() => setLoaded(true));
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { fileName, loaded, reload };
}
