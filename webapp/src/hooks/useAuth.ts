import { useCallback, useState } from "react";

const TOKEN_KEY = "family_token";

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );

  const login = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    localStorage.setItem(TOKEN_KEY, trimmed);
    setToken(trimmed);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  return { token, login, logout };
};
