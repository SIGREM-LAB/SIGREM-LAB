import { ItemInventario } from "../store/inventoryStore";

interface TablaInventarioProps {
  items: ItemInventario[];
}

export default function TablaInventario({ items }: TablaInventarioProps) {
  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case "Disponible":
        return "bg-green-100 text-green-800";
      case "Stock bajo":
        return "bg-yellow-100 text-yellow-800";
      case "Agotado":
        return "bg-red-100 text-red-800";
      case "Contaminado":
        return "bg-purple-100 text-purple-800";
      case "Mantenimiento":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F5F6F8] border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm text-[#6F6F6E]">Código</th>
              <th className="px-6 py-4 text-left text-sm text-[#6F6F6E]">Nombre</th>
              <th className="px-6 py-4 text-left text-sm text-[#6F6F6E]">Tipo</th>
              <th className="px-6 py-4 text-left text-sm text-[#6F6F6E]">Existencia</th>
              <th className="px-6 py-4 text-left text-sm text-[#6F6F6E]">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[#6F6F6E]">
                  No hay elementos en el inventario
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.codigo} className="hover:bg-[#F5F6F8] transition-colors">
                  <td className="px-6 py-4">{item.codigo}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p>{item.nombre}</p>
                      <p className="text-sm text-[#6F6F6E]">{item.marca}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">{item.tipo}</td>
                  <td className="px-6 py-4">
                    {item.existencia} {item.unidad}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${getEstadoColor(item.estado)}`}>
                      {item.estado}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
