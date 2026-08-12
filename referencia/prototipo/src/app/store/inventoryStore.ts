import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TipoElemento = "Reactivo líquido" | "Reactivo sólido" | "Material" | "Equipo";
export type UnidadMedida = "ml" | "L" | "g" | "kg" | "piezas";
export type EstadoInventario = "Disponible" | "Stock bajo" | "Agotado" | "Contaminado" | "Mantenimiento";

export interface ItemInventario {
  codigo: string;
  nombre: string;
  marca: string;
  descripcion: string;
  tipo: TipoElemento;
  existencia: number;
  existenciaInicial: number;
  unidad: UnidadMedida;
  cantidadMinima: number;
  fechaAdquisicion: string;
  fechaCaducidad?: string;
  estado: EstadoInventario;
  qrCode: string;
}

interface InventoryState {
  items: ItemInventario[];
  addItem: (item: Omit<ItemInventario, 'codigo' | 'qrCode' | 'estado'>) => void;
  updateItem: (codigo: string, item: Partial<ItemInventario>) => void;
  deleteItem: (codigo: string) => void;
  getNextCode: () => string;
  updateExistencia: (codigo: string, nuevaExistencia: number) => void;
  getItemByCodigo: (codigo: string) => ItemInventario | undefined;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      items: [],
      
      getNextCode: () => {
        const items = get().items;
        const maxNum = items.reduce((max, item) => {
          const num = parseInt(item.codigo.split('-')[1]);
          return num > max ? num : max;
        }, 0);
        return `INV-${String(maxNum + 1).padStart(4, '0')}`;
      },

      addItem: (item) => {
        const codigo = get().getNextCode();
        const qrCode = codigo;
        const estado = item.existencia <= item.cantidadMinima ? 
          (item.existencia === 0 ? "Agotado" : "Stock bajo") : 
          "Disponible";
        
        set((state) => ({
          items: [...state.items, { ...item, codigo, qrCode, estado }],
        }));
      },

      updateItem: (codigo, updatedItem) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.codigo === codigo ? { ...item, ...updatedItem } : item
          ),
        }));
      },

      deleteItem: (codigo) => {
        set((state) => ({
          items: state.items.filter((item) => item.codigo !== codigo),
        }));
      },

      updateExistencia: (codigo, nuevaExistencia) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.codigo === codigo) {
              const estado = nuevaExistencia <= item.cantidadMinima ? 
                (nuevaExistencia === 0 ? "Agotado" : "Stock bajo") : 
                "Disponible";
              return { ...item, existencia: nuevaExistencia, estado };
            }
            return item;
          }),
        }));
      },

      getItemByCodigo: (codigo) => {
        return get().items.find((item) => item.codigo === codigo);
      },
    }),
    {
      name: 'inventory-storage',
    }
  )
);
