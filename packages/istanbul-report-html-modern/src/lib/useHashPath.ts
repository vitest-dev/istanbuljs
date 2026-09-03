import { useCallback, useEffect, useState } from "react";

import { readHashPath, writeHashPath } from "./hash-route";

export function useHashPath(defaultPath = ""): [string, (path: string) => void] {
  const [path, setPath] = useState(() => {
    const fromHash = readHashPath();
    return fromHash === "" ? defaultPath : fromHash;
  });

  useEffect(() => {
    const onHashChange = () => {
      setPath(readHashPath());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  useEffect(() => {
    writeHashPath(path);
  }, [path]);

  const navigate = useCallback((next: string) => {
    setPath(next);
  }, []);

  return [path, navigate];
}
