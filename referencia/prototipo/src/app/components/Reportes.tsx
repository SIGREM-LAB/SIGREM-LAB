import { useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { usePracticasStore } from "../store/practicasStore";
import { toast } from "sonner";

export default function Reportes() {
  const practicas = usePracticasStore((state) => state.practicas);
  
  const [filtros, setFiltros] = useState({
    fechaInicio: "",
    fechaFin: "",
    laboratorio: "",
    asignatura: "",
    tipoElemento: "General",
  });

  const practicasFiltradas = practicas.filter((practica) => {
    if (filtros.fechaInicio && practica.fecha < filtros.fechaInicio) return false;
    if (filtros.fechaFin && practica.fecha > filtros.fechaFin) return false;
    if (filtros.laboratorio && practica.laboratorio !== filtros.laboratorio) return false;
    if (filtros.asignatura && practica.asignatura !== filtros.asignatura) return false;
    return true;
  });

  const resultados = practicasFiltradas.flatMap((practica) => 
    practica.elementos
      .filter((el) => {
        if (filtros.tipoElemento === "General") return true;
        if (filtros.tipoElemento === "Reactivos") 
          return el.tipo === "Reactivo líquido" || el.tipo === "Reactivo sólido";
        if (filtros.tipoElemento === "Materiales") return el.tipo === "Material";
        if (filtros.tipoElemento === "Equipos") return el.tipo === "Equipo";
        return true;
      })
      .map((el) => ({
        fecha: practica.fecha,
        codigo: el.codigo,
        elemento: el.nombre,
        tipo: el.tipo,
        consumoUso: el.consumo || el.perdidas || "-",
        practica: practica.numeroPractica,
        laboratorio: practica.laboratorio,
        asignatura: practica.asignatura,
      }))
  );

  const handleExportarExcel = () => {
    // Simulación de exportación
    toast.success("Reporte exportado a Excel");
  };

  const handleExportarPDF = () => {
    // Simulación de exportación
    toast.success("Reporte exportado a PDF");
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl mb-2">Reportes y Estadísticas</h1>
        <p className="text-[#6F6F6E]">Análisis del uso de reactivos, materiales y equipos</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <h3 className="text-lg mb-4">Filtros de Búsqueda</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={filtros.fechaInicio}
              onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            />
          </div>
          <div>
            <label className="block mb-2">Fecha Fin</label>
            <input
              type="date"
              value={filtros.fechaFin}
              onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            />
          </div>
          <div>
            <label className="block mb-2">Tipo de Elemento</label>
            <select
              value={filtros.tipoElemento}
              onChange={(e) => setFiltros({ ...filtros, tipoElemento: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            >
              <option value="General">General</option>
              <option value="Reactivos">Reactivos</option>
              <option value="Materiales">Materiales</option>
              <option value="Equipos">Equipos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de resultados */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg">Resultados ({resultados.length} registros)</h3>
          <div className="flex gap-2">
            <button
              onClick={handleExportarExcel}
              className="px-4 py-2 bg-[#ED5E17] text-white rounded-lg hover:bg-[#C10230] transition-colors flex items-center gap-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Exportar a Excel
            </button>
            <button
              onClick={handleExportarPDF}
              className="px-4 py-2 bg-[#C10230] text-white rounded-lg hover:bg-[#A21A19] transition-colors flex items-center gap-2"
            >
              <FileDown className="w-5 h-5" />
              Exportar a PDF
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F6F8] border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm text-[#6F6F6E]">Fecha</th>
                <th className="px-4 py-3 text-left text-sm text-[#6F6F6E]">Código</th>
                <th className="px-4 py-3 text-left text-sm text-[#6F6F6E]">Elemento</th>
                <th className="px-4 py-3 text-left text-sm text-[#6F6F6E]">Tipo</th>
                <th className="px-4 py-3 text-left text-sm text-[#6F6F6E]">Consumo/Uso</th>
                <th className="px-4 py-3 text-left text-sm text-[#6F6F6E]">Práctica</th>
                <th className="px-4 py-3 text-left text-sm text-[#6F6F6E]">Laboratorio</th>
                <th className="px-4 py-3 text-left text-sm text-[#6F6F6E]">Asignatura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {resultados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#6F6F6E]">
                    No hay resultados para mostrar
                  </td>
                </tr>
              ) : (
                resultados.map((resultado, index) => (
                  <tr key={index} className="hover:bg-[#F5F6F8] transition-colors">
                    <td className="px-4 py-3">{resultado.fecha}</td>
                    <td className="px-4 py-3">{resultado.codigo}</td>
                    <td className="px-4 py-3">{resultado.elemento}</td>
                    <td className="px-4 py-3">{resultado.tipo}</td>
                    <td className="px-4 py-3">{resultado.consumoUso}</td>
                    <td className="px-4 py-3">{resultado.practica}</td>
                    <td className="px-4 py-3">{resultado.laboratorio}</td>
                    <td className="px-4 py-3">{resultado.asignatura}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen */}
      {resultados.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg mb-4">Resumen Estadístico</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#F5F6F8] p-4 rounded-lg">
              <p className="text-2xl text-[#C10230]">{resultados.length}</p>
              <p className="text-sm text-[#6F6F6E]">Total de registros</p>
            </div>
            <div className="bg-[#F5F6F8] p-4 rounded-lg">
              <p className="text-2xl text-[#ED5E17]">
                {new Set(resultados.map(r => r.practica)).size}
              </p>
              <p className="text-sm text-[#6F6F6E]">Prácticas</p>
            </div>
            <div className="bg-[#F5F6F8] p-4 rounded-lg">
              <p className="text-2xl text-[#FF8300]">
                {new Set(resultados.map(r => r.codigo)).size}
              </p>
              <p className="text-sm text-[#6F6F6E]">Elementos únicos</p>
            </div>
            <div className="bg-[#F5F6F8] p-4 rounded-lg">
              <p className="text-2xl text-[#6F6F6E]">
                {new Set(resultados.map(r => r.laboratorio)).size}
              </p>
              <p className="text-sm text-[#6F6F6E]">Laboratorios</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
