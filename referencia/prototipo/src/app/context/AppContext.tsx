import { createContext, useContext, useState } from "react";

interface AppContextType {
  enUso: Record<string, string>;
  marcarEnUso: (codigo: string, practica: string) => void;
  liberar: (codigo: string) => void;
  liberarTodos: (codigos: string[]) => void;
  estaEnUso: (codigo: string) => string | null;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [enUso, setEnUso] = useState<Record<string, string>>({});

  const marcarEnUso = (codigo: string, practica: string) => {
    setEnUso((prev) => ({ ...prev, [codigo]: practica }));
  };

  const liberar = (codigo: string) => {
    setEnUso((prev) => {
      const next = { ...prev };
      delete next[codigo];
      return next;
    });
  };

  const liberarTodos = (codigos: string[]) => {
    setEnUso((prev) => {
      const next = { ...prev };
      codigos.forEach((c) => delete next[c]);
      return next;
    });
  };

  const estaEnUso = (codigo: string): string | null => enUso[codigo] ?? null;

  return (
    <AppContext.Provider value={{ enUso, marcarEnUso, liberar, liberarTodos, estaEnUso }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
