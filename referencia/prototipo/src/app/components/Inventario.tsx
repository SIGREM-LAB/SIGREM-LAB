import { useState } from "react";
import { Search, Plus, Filter } from "lucide-react";
import { useInventoryStore, TipoElemento } from "../store/inventoryStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@radix-ui/react-dialog";
import NuevoElementoForm from "./NuevoElementoForm";
import TablaInventario from "./TablaInventario";

export default function Inventario() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoElemento | "Todos">("Todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const items = useInventoryStore((state) => state.items);

  const itemsFiltrados = items.filter((item) => {
    const matchSearch = 
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.marca.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchTipo = filtroTipo === "Todos" || item.tipo === filtroTipo;
    
    return matchSearch && matchTipo;
  });

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-3xl mb-2">Inventario de Laboratorio</h1>
        <p className="text-[#6F6F6E]">
          Administración de reactivos, materiales y equipos
        </p>
      </div>

      {/* Barra de herramientas */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-4">
          {/* Buscador */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6F6F6E]" />
            <input
              type="text"
              placeholder="Buscar por nombre, código o marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            />
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-[#6F6F6E]" />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as TipoElemento | "Todos")}
              className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            >
              <option value="Todos">Todos</option>
              <option value="Reactivo líquido">Reactivos líquidos</option>
              <option value="Reactivo sólido">Reactivos sólidos</option>
              <option value="Material">Materiales</option>
              <option value="Equipo">Equipos</option>
            </select>
          </div>

          {/* Botón nuevo elemento */}
          <button
            onClick={() => setIsDialogOpen(true)}
            className="px-6 py-3 bg-[#C10230] text-white rounded-lg hover:bg-[#A21A19] transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo elemento
          </button>
        </div>
      </div>

      {/* Tabla de inventario */}
      <TablaInventario items={itemsFiltrados} />

      {/* Dialog para nuevo elemento */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl">Nuevo Elemento</h2>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="text-[#6F6F6E] hover:text-black"
              >
                ✕
              </button>
            </div>
            <NuevoElementoForm onClose={() => setIsDialogOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
