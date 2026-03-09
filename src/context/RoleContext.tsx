import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

type Role = 'athlete' | 'coach';

interface RoleContextType {
  activeRole: Role;
  setActiveRole: (role: Role) => void;
  isCoachMode: boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [activeRole, setActiveRoleState] = useState<Role>(() => {
    const stored = localStorage.getItem("activeRole") as Role | null;
    return stored === 'coach' ? 'coach' : 'athlete';
  });

  useEffect(() => {
    if (!user?.is_coach && activeRole === 'coach') {
      setActiveRoleState('athlete');
      localStorage.setItem("activeRole", "athlete");
    }
  }, [user, activeRole]);

  function setActiveRole(role: Role) {
    if (role === 'coach' && !user?.is_coach) return;
    setActiveRoleState(role);
    localStorage.setItem("activeRole", role);
  }

  return (
    <RoleContext.Provider value={{ activeRole, setActiveRole, isCoachMode: activeRole === 'coach' }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
