import { useState } from "react";
import { QrCode, Search, Scale, Save } from "lucide-react";
import { usePracticasStore, ElementoUsado, MetodoControl, EstadoEquipo } from "../store/practicasStore";
import { useInventoryStore } from "../store/inventoryStore";
import { toast } from "sonner";

const PROGRAMAS_EDUCATIVOS = [
  "Ingeniería Minero-Metalúrgica",
  "Química de Alimentos",
  "Biología",
  "Licenciatura en Ingeniería de Materiales",
  "Ingeniería en Geología Ambiental",
  "Ingeniería Civil",
  "Ingeniería Industrial",
  "Química",
];

const LABORATORIOS = [
  "Laboratorio de Química General",
  "Laboratorio de Física",
  "Laboratorio de Biología",
  "Laboratorio de Materiales",
  "Laboratorio de Geología",
];

const ASIGNATURAS = [
  "Química Inorgánica",
  "Química Orgánica",
  "Física I",
  "Física II",
  "Biología Celular",
  "Materiales Compuestos",
  "Geología Estructural",
];

export default function Practicas() {
  const addPractica = usePracticasStore((state) => state.addPractica);
  const getNextNumeroPractica = usePracticasStore((state) => state.getNextNumeroPractica);
  const inventario = useInventoryStore((state) => state.items);
  const updateExistencia = useInventoryStore((state) => state.updateExistencia);
  
  const [programaEducativo, setProgramaEducativo] = useState("");
  const [laboratorio, setLaboratorio] = useState("");
  const [asignatura, setAsignatura] = useState("");
  const [elementos, setElementos] = useState<ElementoUsado[]>([]);
  const [elementoSeleccionado, setElementoSeleccionado] = useState<ElementoUsado | null>(null);
  const [searchCode, setSearchCode] = useState("");
  
  const [observaciones, setObservaciones] = useState({
    noTenemos: false,
    prestamoN4: false,
    prestamoN3: false,
    prestamoLUM: false,
    contaminado: false,
    seTermino: false,
    materialDañado: false,
    equipoDañado: false,
    otro: false,
    descripcionAdicional: "",
  });

  const numeroPractica = getNextNumeroPractica();
  const fechaActual = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleBuscarElemento = () => {
    const item = inventario.find((i) => i.codigo === searchCode.toUpperCase());
    if (item) {
      const metodoControl: MetodoControl = 
        item.tipo === "Reactivo líquido" || item.tipo === "Reactivo sólido" ? "Peso" :
        item.tipo === "Material" ? "Cantidad" : "Préstamo";
      
      const nuevoElemento: ElementoUsado = {
        codigo: item.codigo,
        nombre: item.nombre,
        tipo: item.tipo,
        metodoControl,
      };
      
      setElementos([...elementos, nuevoElemento]);
      setElementoSeleccionado(nuevoElemento);
      setSearchCode("");
      toast.success(`Elemento ${item.nombre} agregado`);
    } else {
      toast.error("Código no encontrado");
    }
  };

  const handleEscanearQR = () => {
    toast.info("Función de escaneo QR simulada. Use el buscador manual.");
  };

  const actualizarElemento = (codigo: string, updates: Partial<ElementoUsado>) => {
    setElementos(elementos.map(el => 
      el.codigo === codigo ? { ...el, ...updates } : el
    ));
    if (elementoSeleccionado?.codigo === codigo) {
      setElementoSeleccionado({ ...elementoSeleccionado, ...updates });
    }
  };

  const handleGuardarPractica = () => {
    if (!programaEducativo || !laboratorio || !asignatura) {
      toast.error("Complete todos los campos requeridos");
      return;
    }

    if (elementos.length === 0) {
      toast.error("Agregue al menos un elemento");
      return;
    }

    // Actualizar inventario
    elementos.forEach((elemento) => {
      const item = inventario.find((i) => i.codigo === elemento.codigo);
      if (item) {
        if (elemento.consumo) {
          const nuevaExistencia = item.existencia - elemento.consumo;
          updateExistencia(item.codigo, Math.max(0, nuevaExistencia));
        } else if (elemento.perdidas) {
          const nuevaExistencia = item.existencia - elemento.perdidas;
          updateExistencia(item.codigo, Math.max(0, nuevaExistencia));
        }
      }
    });

    addPractica({
      programaEducativo,
      laboratorio,
      asignatura,
      elementos,
      observacionesGenerales: observaciones,
    });

    toast.success(`Práctica ${numeroPractica} guardada exitosamente`);
    
    // Limpiar formulario
    setProgramaEducativo("");
    setLaboratorio("");
    setAsignatura("");
    setElementos([]);
    setElementoSeleccionado(null);
    setObservaciones({
      noTenemos: false,
      prestamoN4: false,
      prestamoN3: false,
      prestamoLUM: false,
      contaminado: false,
      seTermino: false,
      materialDañado: false,
      equipoDañado: false,
      otro: false,
      descripcionAdicional: "",
    });
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl mb-2">Registro de Prácticas</h1>
        <p className="text-[#6F6F6E]">Captura de uso de reactivos, materiales y equipos</p>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        {/* Datos de la práctica */}
        <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-gray-200">
          <div>
            <label className="block mb-2">Programa Educativo *</label>
            <select
              value={programaEducativo}
              onChange={(e) => setProgramaEducativo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            >
              <option value="">Seleccione...</option>
              {PROGRAMAS_EDUCATIVOS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2">Laboratorio *</label>
            <select
              value={laboratorio}
              onChange={(e) => setLaboratorio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            >
              <option value="">Seleccione...</option>
              {LABORATORIOS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2">Asignatura *</label>
            <select
              value={asignatura}
              onChange={(e) => setAsignatura(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            >
              <option value="">Seleccione...</option>
              {ASIGNATURAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2">Número de Práctica</label>
            <input
              type="text"
              value={numeroPractica}
              disabled
              className="w-full px-4 py-2 bg-[#F5F6F8] border border-gray-200 rounded-lg"
            />
          </div>

          <div className="col-span-2">
            <label className="block mb-2">Fecha</label>
            <input
              type="text"
              value={fechaActual}
              disabled
              className="w-full px-4 py-2 bg-[#F5F6F8] border border-gray-200 rounded-lg"
            />
          </div>
        </div>

        {/* Agregar elementos */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-lg mb-4">Agregar Elementos</h3>
          <div className="flex gap-4">
            <button
              onClick={handleEscanearQR}
              className="px-6 py-3 bg-[#C10230] text-white rounded-lg hover:bg-[#A21A19] transition-colors flex items-center gap-2"
            >
              <QrCode className="w-5 h-5" />
              Escanear QR
            </button>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="Buscar por código..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBuscarElemento()}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
              />
              <button
                onClick={handleBuscarElemento}
                className="px-6 py-2 bg-[#ED5E17] text-white rounded-lg hover:bg-[#C10230] transition-colors flex items-center gap-2"
              >
                <Search className="w-5 h-5" />
                Buscar
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de elementos utilizados */}
        {elementos.length > 0 && (
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-lg mb-4">Elementos Utilizados</h3>
            <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-[#F5F6F8]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm">Código</th>
                  <th className="px-4 py-3 text-left text-sm">Nombre</th>
                  <th className="px-4 py-3 text-left text-sm">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm">Método de Control</th>
                  <th className="px-4 py-3 text-left text-sm">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {elementos.map((el) => (
                  <tr key={el.codigo} className="hover:bg-[#F5F6F8]">
                    <td className="px-4 py-3">{el.codigo}</td>
                    <td className="px-4 py-3">{el.nombre}</td>
                    <td className="px-4 py-3">{el.tipo}</td>
                    <td className="px-4 py-3">{el.metodoControl}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setElementoSeleccionado(el)}
                        className="text-[#C10230] hover:underline"
                      >
                        Capturar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Panel inteligente de captura */}
        {elementoSeleccionado && (
          <PanelCaptura
            elemento={elementoSeleccionado}
            onUpdate={(updates) => actualizarElemento(elementoSeleccionado.codigo, updates)}
          />
        )}

        {/* Observaciones generales */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-lg mb-4">Observaciones Generales</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { key: 'noTenemos', label: 'No tenemos' },
              { key: 'prestamoN4', label: 'Préstamo N4' },
              { key: 'prestamoN3', label: 'Préstamo N3' },
              { key: 'prestamoLUM', label: 'Préstamo LUM' },
              { key: 'contaminado', label: 'Contaminado' },
              { key: 'seTermino', label: 'Se terminó' },
              { key: 'materialDañado', label: 'Material dañado' },
              { key: 'equipoDañado', label: 'Equipo dañado' },
              { key: 'otro', label: 'Otro' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={observaciones[key as keyof typeof observaciones] as boolean}
                  onChange={(e) => setObservaciones({ ...observaciones, [key]: e.target.checked })}
                  className="w-4 h-4 accent-[#C10230]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <textarea
            placeholder="Descripción adicional..."
            value={observaciones.descripcionAdicional}
            onChange={(e) => setObservaciones({ ...observaciones, descripcionAdicional: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
          />
        </div>

        {/* Botón guardar */}
        <button
          onClick={handleGuardarPractica}
          className="w-full px-6 py-4 bg-[#C10230] text-white rounded-lg hover:bg-[#A21A19] transition-colors flex items-center justify-center gap-2 text-lg"
        >
          <Save className="w-6 h-6" />
          Guardar Práctica
        </button>
      </div>
    </div>
  );
}

interface PanelCapturaProps {
  elemento: ElementoUsado;
  onUpdate: (updates: Partial<ElementoUsado>) => void;
}

function PanelCaptura({ elemento, onUpdate }: PanelCapturaProps) {
  if (elemento.metodoControl === "Peso") {
    return (
      <div className="mb-6 pb-6 border-b border-gray-200 bg-[#F5F6F8] p-6 rounded-lg">
        <h3 className="text-lg mb-4 flex items-center gap-2">
          <Scale className="w-5 h-5" />
          Captura de Peso - {elemento.nombre}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block mb-2">Peso Inicial (g)</label>
            <input
              type="number"
              step="0.01"
              value={elemento.pesoInicial || ""}
              onChange={(e) => {
                const pesoInicial = parseFloat(e.target.value);
                const consumo = elemento.pesoFinal ? pesoInicial - elemento.pesoFinal : 0;
                onUpdate({ pesoInicial, consumo });
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            />
          </div>
          <div>
            <label className="block mb-2">Peso Final (g)</label>
            <input
              type="number"
              step="0.01"
              value={elemento.pesoFinal || ""}
              onChange={(e) => {
                const pesoFinal = parseFloat(e.target.value);
                const consumo = elemento.pesoInicial ? elemento.pesoInicial - pesoFinal : 0;
                onUpdate({ pesoFinal, consumo });
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            />
          </div>
          <div>
            <label className="block mb-2">Consumo (g)</label>
            <input
              type="number"
              value={elemento.consumo || 0}
              disabled
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg"
            />
          </div>
        </div>
      </div>
    );
  }

  if (elemento.metodoControl === "Cantidad") {
    return (
      <div className="mb-6 pb-6 border-b border-gray-200 bg-[#F5F6F8] p-6 rounded-lg">
        <h3 className="text-lg mb-4">Captura de Cantidad - {elemento.nombre}</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block mb-2">Cantidad Entregada</label>
            <input
              type="number"
              value={elemento.cantidadEntregada || ""}
              onChange={(e) => {
                const cantidadEntregada = parseInt(e.target.value);
                const perdidas = cantidadEntregada - (elemento.cantidadDevuelta || 0) - (elemento.cantidadDañada || 0);
                onUpdate({ cantidadEntregada, perdidas });
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            />
          </div>
          <div>
            <label className="block mb-2">Cantidad Devuelta</label>
            <input
              type="number"
              value={elemento.cantidadDevuelta || ""}
              onChange={(e) => {
                const cantidadDevuelta = parseInt(e.target.value);
                const perdidas = (elemento.cantidadEntregada || 0) - cantidadDevuelta - (elemento.cantidadDañada || 0);
                onUpdate({ cantidadDevuelta, perdidas });
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            />
          </div>
          <div>
            <label className="block mb-2">Cantidad Dañada</label>
            <input
              type="number"
              value={elemento.cantidadDañada || ""}
              onChange={(e) => {
                const cantidadDañada = parseInt(e.target.value);
                const perdidas = (elemento.cantidadEntregada || 0) - (elemento.cantidadDevuelta || 0) - cantidadDañada;
                onUpdate({ cantidadDañada, perdidas });
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            />
          </div>
          <div>
            <label className="block mb-2">Pérdidas</label>
            <input
              type="number"
              value={elemento.perdidas || 0}
              disabled
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg"
            />
          </div>
        </div>
      </div>
    );
  }

  if (elemento.metodoControl === "Préstamo") {
    return (
      <div className="mb-6 pb-6 border-b border-gray-200 bg-[#F5F6F8] p-6 rounded-lg">
        <h3 className="text-lg mb-4">Captura de Préstamo - {elemento.nombre}</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2">Estado de Salida</label>
            <select
              value={elemento.estadoSalida || ""}
              onChange={(e) => onUpdate({ estadoSalida: e.target.value as EstadoEquipo })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            >
              <option value="">Seleccione...</option>
              <option value="Bueno">Bueno</option>
              <option value="Regular">Regular</option>
              <option value="Dañado">Dañado</option>
              <option value="Mantenimiento">Mantenimiento</option>
            </select>
          </div>
          <div>
            <label className="block mb-2">Estado de Devolución</label>
            <select
              value={elemento.estadoDevolucion || ""}
              onChange={(e) => onUpdate({ estadoDevolucion: e.target.value as EstadoEquipo })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
            >
              <option value="">Seleccione...</option>
              <option value="Bueno">Bueno</option>
              <option value="Regular">Regular</option>
              <option value="Dañado">Dañado</option>
              <option value="Mantenimiento">Mantenimiento</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block mb-2">Observaciones</label>
          <textarea
            value={elemento.observaciones || ""}
            onChange={(e) => onUpdate({ observaciones: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C10230]"
          />
        </div>
      </div>
    );
  }

  return null;
}
