import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MetodoControl = "Peso" | "Cantidad" | "Préstamo";
export type EstadoEquipo = "Bueno" | "Regular" | "Dañado" | "Mantenimiento";

export interface ElementoUsado {
  codigo: string;
  nombre: string;
  tipo: string;
  metodoControl: MetodoControl;
  
  // Para reactivos (peso)
  pesoInicial?: number;
  pesoFinal?: number;
  consumo?: number;
  
  // Para materiales (cantidad)
  cantidadEntregada?: number;
  cantidadDevuelta?: number;
  cantidadDañada?: number;
  perdidas?: number;
  
  // Para equipos (préstamo)
  estadoSalida?: EstadoEquipo;
  estadoDevolucion?: EstadoEquipo;
  observaciones?: string;
}

export interface Practica {
  numeroPractica: string;
  programaEducativo: string;
  laboratorio: string;
  asignatura: string;
  fecha: string;
  elementos: ElementoUsado[];
  observacionesGenerales: {
    noTenemos: boolean;
    prestamoN4: boolean;
    prestamoN3: boolean;
    prestamoLUM: boolean;
    contaminado: boolean;
    seTermino: boolean;
    materialDañado: boolean;
    equipoDañado: boolean;
    otro: boolean;
    descripcionAdicional: string;
  };
}

interface PracticasState {
  practicas: Practica[];
  addPractica: (practica: Omit<Practica, 'numeroPractica' | 'fecha'>) => void;
  getNextNumeroPractica: () => string;
}

export const usePracticasStore = create<PracticasState>()(
  persist(
    (set, get) => ({
      practicas: [],
      
      getNextNumeroPractica: () => {
        const practicas = get().practicas;
        const maxNum = practicas.reduce((max, practica) => {
          const num = parseInt(practica.numeroPractica.split('-')[1]);
          return num > max ? num : max;
        }, 0);
        return `PRA-${String(maxNum + 1).padStart(4, '0')}`;
      },

      addPractica: (practica) => {
        const numeroPractica = get().getNextNumeroPractica();
        const fecha = new Date().toISOString().split('T')[0];
        
        set((state) => ({
          practicas: [...state.practicas, { ...practica, numeroPractica, fecha }],
        }));
      },
    }),
    {
      name: 'practicas-storage',
    }
  )
);
