import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "../types";
import { getMe } from "../api/auth";
import i18n from "../i18n";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      getMe()
        .then((res) => {
          setUserState(res.data);
          if (res.data.language) {
            i18n.changeLanguage(res.data.language);
          }
        })
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
          setUserState(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  // Sync logout across browser tabs: when another tab removes the token from
  // localStorage, this tab detects the change and clears its auth state.
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key === "token" && e.newValue === null) {
        setToken(null);
        setUserState(null);
      }
    }
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  function login(newToken: string, newUser: User) {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUserState(newUser);
    if (newUser.language) {
      i18n.changeLanguage(newUser.language);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUserState(null);
  }

  function setUser(updatedUser: User) {
    setUserState(updatedUser);
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token && !!user, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
