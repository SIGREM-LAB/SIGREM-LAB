import { useState } from "react";
import { useInventoryStore, TipoElemento, UnidadMedida } from "../store/inventoryStore";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";

interface NuevoElementoFormProps {
  onClose: () => void;
}

export default function NuevoElementoForm({ onClose }: NuevoElementoFormProps) {
  const addItem = useInventoryStore((state) => state.addItem);
  const getNextCode = useInventoryStore((state) => state.getNextCode);
  
  const [showQR, setShowQR] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  
  const [formData, setFormData] = useState({
    nombre: "",
    marca: "",
    descripcion: "",
    tipo: "Reactivo líquido" as TipoElemento,
    existenciaInicial: 0,
    unidad: "ml" as UnidadMedida,
    cantidadMinima: 0,
    fechaAdquisicion: new Date().toISOString().split('T')[0],
    fechaCaducidad: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newItem = {
      ...formData,
      existencia: formData.existenciaInicial,
      fechaCaducidad: (formData.tipo === "Reactivo líquido" || formData.tipo === "Reactivo sólido") 
        ? formData.fechaCaducidad 
        : undefined,
    };
    
    addItem(newItem);
    const code = getNextCode();
    setGeneratedCode(code);
    setShowQR(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (showQR) {
    return (
      <div className="text-center">
        <h3 className="text-xl mb-4">¡Elemento creado exitosamente!</h3>
        <div className="bg-[#F5F6F8] p-6 rounded-lg inline-block mb-4">
          <p className="mb-2">Código: <strong>{generatedCode}</strong></p>
          <QRCodeSVG value={generatedCode} size={200} />
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-[#C10230] text-white rounded-lg hover:bg-[#A21A19] transition-colors flex items-center gap-2"
          >
            <Printer className="w-5 h-5" />
            Imprimir etiqueta
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-[#6F6F6E] text-white rounded-lg hover:bg-[#5F5F5E] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2">Nombre *</label>
          <input
            type="text"
            required
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
          />
        </div>

        <div>
          <label className="block mb-2">Marca *</label>
          <input
            type="text"
            required
            value={formData.marca}
            onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
          />
        </div>
      </div>

      <div>
        <label className="block mb-2">Descripción</label>
        <textarea
          value={formData.descripcion}
          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
          rows={3}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
        />
      </div>

      <div>
        <label className="block mb-2">Tipo de elemento *</label>
        <select
          value={formData.tipo}
          onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoElemento })}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
        >
          <option value="Reactivo líquido">Reactivo líquido</option>
          <option value="Reactivo sólido">Reactivo sólido</option>
          <option value="Material">Material</option>
          <option value="Equipo">Equipo</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2">Existencia inicial *</label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.existenciaInicial}
            onChange={(e) => setFormData({ ...formData, existenciaInicial: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
          />
        </div>

        <div>
          <label className="block mb-2">Unidad de medida *</label>
          <select
            value={formData.unidad}
            onChange={(e) => setFormData({ ...formData, unidad: e.target.value as UnidadMedida })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
          >
            <option value="ml">ml</option>
            <option value="L">L</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="piezas">piezas</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2">Cantidad mínima *</label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.cantidadMinima}
            onChange={(e) => setFormData({ ...formData, cantidadMinima: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
          />
        </div>

        <div>
          <label className="block mb-2">Fecha de adquisición *</label>
          <input
            type="date"
            required
            value={formData.fechaAdquisicion}
            onChange={(e) => setFormData({ ...formData, fechaAdquisicion: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
          />
        </div>
      </div>

      {(formData.tipo === "Reactivo líquido" || formData.tipo === "Reactivo sólido") && (
        <div>
          <label className="block mb-2">Fecha de caducidad</label>
          <input
            type="date"
            value={formData.fechaCaducidad}
            onChange={(e) => setFormData({ ...formData, fechaCaducidad: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
          />
        </div>
      )}

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-[#C10230] text-white rounded-lg hover:bg-[#A21A19] transition-colors"
        >
          Guardar elemento
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 bg-[#6F6F6E] text-white rounded-lg hover:bg-[#5F5F5E] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
