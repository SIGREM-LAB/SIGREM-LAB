import { createContext, useContext, useState } from "react";

export interface User {
  username: string;
  nombre: string;
  laboratorio: string;
  labCompleto: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const USERS: Record<string, { nombre: string; laboratorio: string; labCompleto: string; isAdmin: boolean }> = {
  alma:      { nombre: "Alma",      laboratorio: "N3",          labCompleto: "Laboratorio N3",          isAdmin: true  },
  alexis:    { nombre: "Alexis",    laboratorio: "N3",          labCompleto: "Laboratorio N3",          isAdmin: false },
  alejandro: { nombre: "Alejandro", laboratorio: "N4",          labCompleto: "Laboratorio N4",          isAdmin: false },
  edgar:     { nombre: "Edgar",     laboratorio: "N4",          labCompleto: "Laboratorio N4",          isAdmin: false },
  omar:      { nombre: "Omar",      laboratorio: "LUM",         labCompleto: "Laboratorio LUM",         isAdmin: false },
  jovani:    { nombre: "Jovani",    laboratorio: "Electrónica", labCompleto: "Laboratorio Electrónica", isAdmin: false },
  elizabeth: { nombre: "Elizabeth", laboratorio: "Electrónica", labCompleto: "Laboratorio Electrónica", isAdmin: false },
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (username: string, password: string): boolean => {
    const key = username.toLowerCase().trim();
    const data = USERS[key];
    if (data && (password === "sigrem2026" || password.length >= 4)) {
      setUser({ username: key, ...data });
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
