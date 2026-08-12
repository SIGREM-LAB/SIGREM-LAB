import { Link } from "react-router";
import { FlaskConical, Package, Microscope, ClipboardList, FileText, TrendingUp } from "lucide-react";
import { useInventoryStore } from "../store/inventoryStore";
import { usePracticasStore } from "../store/practicasStore";

export default function MenuPrincipal() {
  const inventario = useInventoryStore((state) => state.items);
  const practicas = usePracticasStore((state) => state.practicas);

  const totalReactivos = inventario.filter(
    (item) => item.tipo === "Reactivo líquido" || item.tipo === "Reactivo sólido"
  ).length;
  const totalMateriales = inventario.filter((item) => item.tipo === "Material").length;
  const totalEquipos = inventario.filter((item) => item.tipo === "Equipo").length;

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-8">
        <h1 className="text-3xl mb-2">Bienvenido a SIGREM-LAB</h1>
        <p className="text-[#6F6F6E]">
          Sistema Integral de Gestión de Reactivos, Materiales y Equipos de Laboratorio
        </p>
      </div>

      {/* Tarjetas de acceso rápido */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <Link
          to="/inventario"
          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-[#C10230] rounded-lg flex items-center justify-center">
              <FlaskConical className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl">Inventario</h2>
          </div>
          <p className="text-[#6F6F6E] text-sm">
            Administrar reactivos, materiales y equipos del laboratorio
          </p>
        </Link>

        <Link
          to="/practicas"
          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-[#ED5E17] rounded-lg flex items-center justify-center">
              <ClipboardList className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl">Nueva Práctica</h2>
          </div>
          <p className="text-[#6F6F6E] text-sm">
            Registrar el uso de reactivos y equipos en prácticas de laboratorio
          </p>
        </Link>

        <Link
          to="/reportes"
          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-[#FF8300] rounded-lg flex items-center justify-center">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl">Reportes</h2>
          </div>
          <p className="text-[#6F6F6E] text-sm">
            Generar reportes y estadísticas del uso de materiales
          </p>
        </Link>
      </div>

      {/* Indicadores */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg mb-6">Indicadores del Sistema</h3>
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-[#F5F6F8] rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#C10230] rounded-lg flex items-center justify-center">
                <FlaskConical className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl">{totalReactivos}</p>
                <p className="text-sm text-[#6F6F6E]">Reactivos</p>
              </div>
            </div>
          </div>

          <div className="bg-[#F5F6F8] rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#ED5E17] rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl">{totalMateriales}</p>
                <p className="text-sm text-[#6F6F6E]">Materiales</p>
              </div>
            </div>
          </div>

          <div className="bg-[#F5F6F8] rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#FF8300] rounded-lg flex items-center justify-center">
                <Microscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl">{totalEquipos}</p>
                <p className="text-sm text-[#6F6F6E]">Equipos</p>
              </div>
            </div>
          </div>

          <div className="bg-[#F5F6F8] rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#6F6F6E] rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl">{practicas.length}</p>
                <p className="text-sm text-[#6F6F6E]">Prácticas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
