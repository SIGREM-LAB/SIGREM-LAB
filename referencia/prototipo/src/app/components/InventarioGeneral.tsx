import { useState } from "react";
import { Search, Plus, QrCode, Printer, X, ChevronRight, Package, Beaker, Microscope, Box, Leaf, ArrowRightLeft, History, ClipboardList } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router";

type ElementType = "reactivo" | "material" | "equipo" | "insumo" | "biologico";
type EstadoFisico = "liquido" | "solido";
type EstadoInventario = "disponible" | "stock_bajo" | "agotado" | "mantenimiento";
type MovimientoTipo = "entrada" | "consumo_interno" | "ajuste" | "merma" | "caducado" | "cambio_lab";
type TabActiva = "inventario" | "historial";

interface UbicacionFisica { laboratorio: string; almacen: string; }

interface InventoryElement {
  id: string; codigo: string; nombre: string; marca: string;
  modelo?: string; numeroSerie?: string; descripcion: string;
  tipo: ElementType; estadoFisico?: EstadoFisico;
  existencia: number; unidad?: string; stockMinimo: number;
  densidad?: number; fechaRegistro: string; ubicacion: UbicacionFisica;
  estadoMantenimiento?: boolean;
  movHistorial: { fecha: string; accion: string; cantidad: string }[];
}

interface RegistroHistorial {
  id: string; fecha: string; codigo: string; producto: string;
  tipoProd: ElementType; tipoMovimiento: MovimientoTipo;
  cantidad: string; existenciaAnterior: number; existenciaNueva: number;
  responsable: string; observaciones: string; laboratorio: string;
}

function calcularEstado(el: InventoryElement): EstadoInventario {
  if (el.estadoMantenimiento) return "mantenimiento";
  if (el.existencia === 0) return "agotado";
  if (el.existencia <= el.stockMinimo) return "stock_bajo";
  return "disponible";
}

const ESTADO_CONFIG: Record<EstadoInventario, { label: string; dot: string; badge: string }> = {
  disponible:    { label: "Disponible",    dot: "bg-green-500",  badge: "bg-green-50 text-green-700 border-green-200"   },
  stock_bajo:    { label: "Stock Bajo",    dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200"   },
  agotado:       { label: "Agotado",       dot: "bg-red-500",    badge: "bg-red-50 text-red-700 border-red-200"         },
  mantenimiento: { label: "Mantenimiento", dot: "bg-orange-400", badge: "bg-orange-50 text-orange-700 border-orange-200"},
};

const TIPO_LABELS: Record<ElementType, string> = {
  reactivo: "Reactivo", material: "Material / Herramienta",
  equipo: "Equipo / Maquinaria", insumo: "Insumo / Consumible", biologico: "Materia Biológica",
};
const TIPO_COLORS: Record<ElementType, string> = {
  reactivo: "#C10230", material: "#ED5E17", equipo: "#2563EB", insumo: "#16A34A", biologico: "#7C3AED",
};
const TIPO_ICONS: Record<ElementType, React.ReactNode> = {
  reactivo:  <Beaker className="w-4 h-4" />,
  material:  <Package className="w-4 h-4" />,
  equipo:    <Microscope className="w-4 h-4" />,
  insumo:    <Box className="w-4 h-4" />,
  biologico: <Leaf className="w-4 h-4" />,
};
const LAB_COLOR: Record<string, string> = {
  N3: "#C10230", N4: "#ED5E17", LUM: "#2563EB", Electrónica: "#7C3AED",
};

const MOV_LABELS: Record<MovimientoTipo, string> = {
  entrada:          "Entrada de inventario",
  consumo_interno:  "Salida por consumo interno",
  ajuste:           "Ajuste de inventario",
  merma:            "Merma",
  caducado:         "Producto caducado",
  cambio_lab:       "Cambio de laboratorio",
};

const ALMACEN_OPTIONS: Record<string, string[]> = {
  N3:          ["Lab 1", "Lab 2", "Lab 3", "Lab 4", "Análisis de Muestras", "Microbiología"],
  N4:          ["Lab 5", "Lab 6", "Lab 7", "Lab 8", "Taller de Paleontología", "Análisis Sensorial"],
  LUM:         ["LUM"],
  Electrónica: ["Electrónica"],
};
const UNIDADES_MATERIAL  = ["Pieza", "m", "Paquete", "Kit", "Bolsa", "L", "ml"];
const UNIDADES_BIOLOGICO = ["Fragmentos", "Hojas", "mL", "Preparación"];

const SAMPLE: InventoryElement[] = [
  { id: "1", codigo: "REA-001", nombre: "Ácido Sulfúrico", marca: "Merck", descripcion: "H₂SO₄ 98% concentrado", tipo: "reactivo", estadoFisico: "liquido", existencia: 1500, unidad: "ml", stockMinimo: 150, densidad: 1.84, fechaRegistro: "2026-01-15", ubicacion: { laboratorio: "N4", almacen: "Lab 5" }, movHistorial: [{ fecha: "2026-06-20", accion: "Uso en práctica PRA-198", cantidad: "-45 ml" }, { fecha: "2026-05-10", accion: "Entrada de inventario", cantidad: "+500 ml" }] },
  { id: "2", codigo: "REA-002", nombre: "Hidróxido de Sodio", marca: "J.T. Baker", descripcion: "NaOH grado reactivo, pellets", tipo: "reactivo", estadoFisico: "solido", existencia: 150, unidad: "g", stockMinimo: 200, fechaRegistro: "2026-02-01", ubicacion: { laboratorio: "N4", almacen: "Lab 6" }, movHistorial: [{ fecha: "2026-06-22", accion: "Uso en práctica PRA-201", cantidad: "-23.75 g" }] },
  { id: "3", codigo: "MAT-001", nombre: "Vaso de Precipitado 250 ml", marca: "Pyrex", modelo: "VAS-250", descripcion: "Cristalería de borosilicato", tipo: "material", existencia: 24, unidad: "Pieza", stockMinimo: 10, fechaRegistro: "2025-11-20", ubicacion: { laboratorio: "N3", almacen: "Lab 2" }, movHistorial: [{ fecha: "2026-06-20", accion: "Entregado práctica PRA-198", cantidad: "-5 piezas" }, { fecha: "2026-06-20", accion: "Devuelto práctica PRA-198", cantidad: "+4 piezas" }] },
  { id: "4", codigo: "EQU-001", nombre: "Balanza Analítica", marca: "Ohaus", modelo: "Pioneer PA224C", numeroSerie: "B417000341", descripcion: "Capacidad 220g, legibilidad 0.0001g", tipo: "equipo", existencia: 1, stockMinimo: 1, fechaRegistro: "2025-08-10", ubicacion: { laboratorio: "N4", almacen: "Lab 5" }, movHistorial: [{ fecha: "2026-06-23", accion: "Préstamo práctica PRA-202", cantidad: "" }] },
  { id: "5", codigo: "INS-001", nombre: "Guantes de Nitrilo", marca: "Kimberly-Clark", descripcion: "Caja 100 piezas, talla M", tipo: "insumo", existencia: 0, unidad: "Caja", stockMinimo: 2, fechaRegistro: "2026-03-01", ubicacion: { laboratorio: "N3", almacen: "Lab 1" }, movHistorial: [{ fecha: "2026-06-18", accion: "Uso en práctica PRA-195", cantidad: "-1 caja" }] },
  { id: "6", codigo: "EQU-002", nombre: "pH-metro", marca: "Hanna", modelo: "HI2210", numeroSerie: "H2210-1234", descripcion: "Medición de pH con electrodo combinado", tipo: "equipo", existencia: 2, stockMinimo: 1, fechaRegistro: "2025-09-15", estadoMantenimiento: true, ubicacion: { laboratorio: "N3", almacen: "Lab 3" }, movHistorial: [{ fecha: "2026-07-01", accion: "Enviado a mantenimiento", cantidad: "" }] },
  { id: "7", codigo: "BIO-001", nombre: "Musgo Sphagnum", marca: "—", descripcion: "Muestra de briofita para análisis morfológico", tipo: "biologico", existencia: 45, unidad: "Fragmentos", stockMinimo: 10, fechaRegistro: "2026-04-10", ubicacion: { laboratorio: "LUM", almacen: "LUM" }, movHistorial: [{ fecha: "2026-04-10", accion: "Registro inicial", cantidad: "+45 Fragmentos" }] },
  { id: "8", codigo: "EQU-003", nombre: "Osciloscopio Rigol DS1054Z", marca: "Rigol", modelo: "DS1054Z", numeroSerie: "RSGB240001", descripcion: "Osciloscopio digital 4 canales 50MHz", tipo: "equipo", existencia: 3, stockMinimo: 1, fechaRegistro: "2025-10-05", ubicacion: { laboratorio: "Electrónica", almacen: "Electrónica" }, movHistorial: [{ fecha: "2025-10-05", accion: "Registro inicial", cantidad: "+3 equipos" }] },
];

const SAMPLE_HISTORIAL: RegistroHistorial[] = [
  { id: "h1", fecha: "2026-06-20", codigo: "REA-001", producto: "Ácido Sulfúrico",        tipoProd: "reactivo", tipoMovimiento: "consumo_interno", cantidad: "45 ml",  existenciaAnterior: 1545, existenciaNueva: 1500, responsable: "Alma", observaciones: "Práctica PRA-198", laboratorio: "N4" },
  { id: "h2", fecha: "2026-05-10", codigo: "REA-001", producto: "Ácido Sulfúrico",        tipoProd: "reactivo", tipoMovimiento: "entrada",         cantidad: "500 ml", existenciaAnterior: 1000, existenciaNueva: 1500, responsable: "Alma", observaciones: "Compra proveedor Merck", laboratorio: "N4" },
  { id: "h3", fecha: "2026-06-22", codigo: "REA-002", producto: "Hidróxido de Sodio",     tipoProd: "reactivo", tipoMovimiento: "consumo_interno", cantidad: "23.75 g",existenciaAnterior: 173.75, existenciaNueva: 150, responsable: "Alma", observaciones: "Práctica PRA-201", laboratorio: "N4" },
  { id: "h4", fecha: "2026-06-18", codigo: "INS-001", producto: "Guantes de Nitrilo",     tipoProd: "insumo",   tipoMovimiento: "consumo_interno", cantidad: "1 caja", existenciaAnterior: 1,    existenciaNueva: 0,   responsable: "Alma", observaciones: "Práctica PRA-195", laboratorio: "N3" },
  { id: "h5", fecha: "2026-07-01", codigo: "EQU-002", producto: "pH-metro",               tipoProd: "equipo",   tipoMovimiento: "ajuste",         cantidad: "—",      existenciaAnterior: 2,    existenciaNueva: 2,   responsable: "Alma", observaciones: "Enviado a mantenimiento", laboratorio: "N3" },
  { id: "h6", fecha: "2026-04-10", codigo: "BIO-001", producto: "Musgo Sphagnum",         tipoProd: "biologico",tipoMovimiento: "entrada",         cantidad: "45 Fragmentos", existenciaAnterior: 0, existenciaNueva: 45, responsable: "Alma", observaciones: "Registro inicial", laboratorio: "LUM" },
];

const FILTER_OPTIONS = [
  { value: "todos",    label: "Todos" },
  { value: "reactivo", label: "Reactivos" },
  { value: "material", label: "Materiales" },
  { value: "equipo",   label: "Equipos" },
  { value: "insumo",   label: "Insumos" },
  { value: "biologico",label: "Materia Biológica" },
];
const LAB_OPTIONS = ["Todos", "N3", "N4", "LUM", "Electrónica"];

function generateCode(tipo: ElementType, count: number): string {
  const prefix: Record<ElementType, string> = { reactivo: "REA", material: "MAT", equipo: "EQU", insumo: "INS", biologico: "BIO" };
  return `${prefix[tipo]}-${count.toString().padStart(3, "0")}`;
}

function QRBox({ codigo, nombre }: { codigo: string; nombre: string }) {
  const size = 100; const cells = 21; const cell = size / cells;
  const seed = codigo.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      if (r < 7 && c < 7) return r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      if (r < 7 && c >= cells - 7) return r === 0 || r === 6 || c === cells - 1 || c === cells - 7 || (r >= 2 && r <= 4 && c >= cells - 5 && c <= cells - 3);
      if (r >= cells - 7 && c < 7) return r === cells - 1 || r === cells - 7 || c === 0 || c === 6 || (r >= cells - 5 && r <= cells - 3 && c >= 2 && c <= 4);
      return ((seed * (r * 31 + c * 17 + 7)) % 100) > 45;
    })
  );
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="border border-[#C10230] rounded p-2 bg-white">
        <svg width={size} height={size}>
          {grid.map((row, ri) => row.map((on, ci) => on
            ? <rect key={`${ri}-${ci}`} x={ci * cell} y={ri * cell} width={cell} height={cell} fill="#1a1a1a" />
            : null
          ))}
        </svg>
      </div>
      <p className="font-mono text-xs font-bold">{codigo}</p>
      <p className="text-xs text-[#6F6F6E] text-center max-w-[120px] truncate">{nombre}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: EstadoInventario }) {
  const cfg = ESTADO_CONFIG[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

interface FormState {
  tipo: ElementType; estadoFisico: EstadoFisico;
  nombre: string; marca: string; modelo: string; numeroSerie: string;
  descripcion: string; existencia: string; unidad: string;
  stockMinimo: string; densidad: string; fechaRegistro: string; almacen: string;
}
const EMPTY_FORM: FormState = {
  tipo: "reactivo", estadoFisico: "liquido",
  nombre: "", marca: "", modelo: "", numeroSerie: "",
  descripcion: "", existencia: "", unidad: "ml",
  stockMinimo: "", densidad: "", fechaRegistro: new Date().toISOString().split("T")[0], almacen: "",
};

const TODAY = new Date().toISOString().split("T")[0];

export function InventarioGeneral() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── All hooks first ──────────────────────────────────────────────────────
  const [tabActiva, setTabActiva] = useState<TabActiva>("inventario");
  const [filter, setFilter] = useState("todos");
  const [labFilter, setLabFilter] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [inventory, setInventory] = useState<InventoryElement[]>(SAMPLE);
  const [selectedItem, setSelectedItem] = useState<InventoryElement | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showMovDialog, setShowMovDialog] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [historial, setHistorial] = useState<RegistroHistorial[]>(SAMPLE_HISTORIAL);

  // Movimiento fields
  const [movTipo, setMovTipo] = useState<MovimientoTipo>("entrada");
  const [movCantidad, setMovCantidad] = useState("");
  const [movExistenciaFisica, setMovExistenciaFisica] = useState("");
  const [movFecha, setMovFecha] = useState(TODAY);
  const [movMotivo, setMovMotivo] = useState("");
  const [movObs, setMovObs] = useState("");
  const [movLabDestino, setMovLabDestino] = useState("");

  // Historial filters
  const [histFechaInicio, setHistFechaInicio] = useState("2026-01-01");
  const [histFechaFin, setHistFechaFin] = useState(TODAY);
  const [histTipoMov, setHistTipoMov] = useState("todos");
  const [histLab, setHistLab] = useState("Todos");
  const [histTipoProd, setHistTipoProd] = useState("todos");

  // ── Guard after hooks ────────────────────────────────────────────────────
  if (!user?.isAdmin) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-xl font-bold text-[#C10230] mb-2">Acceso restringido</p>
          <p className="text-[#6F6F6E]">Solo administradores pueden acceder al Inventario General.</p>
          <Button className="mt-4 bg-[#C10230] hover:bg-[#A21A19]" onClick={() => navigate("/")}>
            Volver al menú
          </Button>
        </div>
      </div>
    );
  }

  const f = (key: keyof FormState, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const isReactivo  = form.tipo === "reactivo";
  const isMaterial  = form.tipo === "material";
  const isEquipo    = form.tipo === "equipo";
  const isBiologico = form.tipo === "biologico";

  const filtered = inventory.filter((item) => {
    const matchFilter = filter === "todos" || item.tipo === filter;
    const matchLab    = labFilter === "Todos" || item.ubicacion.laboratorio === labFilter;
    const term = searchTerm.toLowerCase();
    const matchSearch = !term || item.nombre.toLowerCase().includes(term) ||
      item.codigo.toLowerCase().includes(term) || item.marca.toLowerCase().includes(term);
    return matchFilter && matchLab && matchSearch;
  });

  const historialFiltrado = historial.filter((h) => {
    const matchTipoMov  = histTipoMov === "todos" || h.tipoMovimiento === histTipoMov;
    const matchLab      = histLab === "Todos" || h.laboratorio === histLab;
    const matchTipoProd = histTipoProd === "todos" || h.tipoProd === histTipoProd;
    const d = new Date(h.fecha);
    const matchDate = d >= new Date(histFechaInicio) && d <= new Date(histFechaFin + "T23:59:59");
    return matchTipoMov && matchLab && matchTipoProd && matchDate;
  });

  const almacenOpts = ALMACEN_OPTIONS[user?.laboratorio ?? ""] ?? [];

  function resetMovimiento() {
    setMovTipo("entrada"); setMovCantidad(""); setMovExistenciaFisica("");
    setMovFecha(TODAY); setMovMotivo(""); setMovObs(""); setMovLabDestino("");
  }

  function handleSave() {
    const count = inventory.filter((i) => i.tipo === form.tipo).length + 1;
    const codigo = generateCode(form.tipo, count);
    const existencia = parseFloat(form.existencia) || 0;
    const el: InventoryElement = {
      id: Date.now().toString(), codigo,
      nombre: form.nombre, marca: form.marca,
      modelo: form.modelo || undefined,
      numeroSerie: isEquipo && form.numeroSerie ? form.numeroSerie : undefined,
      descripcion: form.descripcion, tipo: form.tipo,
      estadoFisico: isReactivo ? form.estadoFisico : undefined,
      existencia, unidad: isEquipo ? undefined : (form.unidad || undefined),
      stockMinimo: parseFloat(form.stockMinimo) || 0,
      densidad: isReactivo && form.estadoFisico === "liquido" && form.densidad ? parseFloat(form.densidad) : undefined,
      fechaRegistro: form.fechaRegistro,
      ubicacion: { laboratorio: user.laboratorio, almacen: form.almacen },
      movHistorial: [{ fecha: form.fechaRegistro, accion: "Registro inicial", cantidad: `+${form.existencia} ${form.unidad || ""}`.trim() }],
    };
    setInventory((prev) => [...prev, el]);
    setSelectedItem(el);
    setShowNewDialog(false);
    setForm({ ...EMPTY_FORM });
    toast.success("Producto registrado", { description: `${codigo} — ${form.nombre}` });
  }

  function handleMovimiento() {
    if (!selectedItem) return;

    let existenciaAnterior = selectedItem.existencia;
    let existenciaNueva    = existenciaAnterior;
    let cantidadStr = "";
    let accion = "";

    if (movTipo === "entrada") {
      const delta = parseFloat(movCantidad) || 0;
      if (delta <= 0) { toast.error("Ingrese una cantidad válida"); return; }
      existenciaNueva = existenciaAnterior + delta;
      cantidadStr = `+${delta} ${selectedItem.unidad ?? ""}`;
      accion = `Entrada de inventario${movObs ? ": " + movObs : ""}`;
    } else if (movTipo === "consumo_interno") {
      const delta = parseFloat(movCantidad) || 0;
      if (delta <= 0) { toast.error("Ingrese una cantidad válida"); return; }
      existenciaNueva = Math.max(0, existenciaAnterior - delta);
      cantidadStr = `-${delta} ${selectedItem.unidad ?? ""}`;
      accion = `Consumo interno${movMotivo ? ": " + movMotivo : ""}`;
    } else if (movTipo === "ajuste") {
      const fisica = parseFloat(movExistenciaFisica);
      if (isNaN(fisica) || fisica < 0) { toast.error("Ingrese la existencia física"); return; }
      const diff = fisica - existenciaAnterior;
      existenciaNueva = fisica;
      cantidadStr = `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} ${selectedItem.unidad ?? ""}`;
      accion = `Ajuste de inventario${movMotivo ? ": " + movMotivo : ""} (física: ${fisica})`;
    } else if (movTipo === "merma") {
      const delta = parseFloat(movCantidad) || 0;
      if (delta <= 0) { toast.error("Ingrese una cantidad válida"); return; }
      existenciaNueva = Math.max(0, existenciaAnterior - delta);
      cantidadStr = `-${delta} ${selectedItem.unidad ?? ""}`;
      accion = `Merma${movMotivo ? ": " + movMotivo : ""}`;
    } else if (movTipo === "caducado") {
      const delta = parseFloat(movCantidad) || 0;
      if (delta <= 0) { toast.error("Ingrese una cantidad válida"); return; }
      existenciaNueva = Math.max(0, existenciaAnterior - delta);
      cantidadStr = `-${delta} ${selectedItem.unidad ?? ""}`;
      accion = `Producto caducado${movObs ? ": " + movObs : ""}`;
    } else if (movTipo === "cambio_lab") {
      if (!movLabDestino) { toast.error("Seleccione el laboratorio destino"); return; }
      if (movLabDestino === selectedItem.ubicacion.laboratorio) { toast.error("El laboratorio destino es el mismo que el origen"); return; }
      accion = `Cambio de laboratorio: ${selectedItem.ubicacion.laboratorio} → ${movLabDestino}`;
      cantidadStr = "";
    }

    const nuevaEntrada = { fecha: movFecha, accion, cantidad: cantidadStr };

    let updatedItem: InventoryElement;
    if (movTipo === "cambio_lab") {
      updatedItem = {
        ...selectedItem,
        ubicacion: { ...selectedItem.ubicacion, laboratorio: movLabDestino },
        movHistorial: [nuevaEntrada, ...selectedItem.movHistorial],
      };
    } else {
      updatedItem = {
        ...selectedItem,
        existencia: existenciaNueva,
        movHistorial: [nuevaEntrada, ...selectedItem.movHistorial],
      };
    }

    setInventory((prev) => prev.map((i) => i.id === selectedItem.id ? updatedItem : i));
    setSelectedItem(updatedItem);

    const registro: RegistroHistorial = {
      id: Date.now().toString(),
      fecha: movFecha,
      codigo: selectedItem.codigo,
      producto: selectedItem.nombre,
      tipoProd: selectedItem.tipo,
      tipoMovimiento: movTipo,
      cantidad: cantidadStr || "—",
      existenciaAnterior,
      existenciaNueva,
      responsable: user.nombre,
      observaciones: movTipo === "cambio_lab" ? `Destino: ${movLabDestino}` : (movObs || movMotivo || ""),
      laboratorio: movTipo === "cambio_lab" ? movLabDestino : selectedItem.ubicacion.laboratorio,
    };
    setHistorial((prev) => [registro, ...prev]);

    setShowMovDialog(false);
    resetMovimiento();
    toast.success("Movimiento registrado", { description: MOV_LABELS[movTipo] });
  }

  const formValid = form.nombre.trim() && form.marca.trim();
  const soloReactivoInsumo = selectedItem?.tipo === "reactivo" || selectedItem?.tipo === "insumo";

  return (
    <div className="flex h-full">
      {/* Main area */}
      <div className={`flex-1 p-8 overflow-auto transition-all ${selectedItem ? "mr-80" : ""}`}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-[#C10230] mb-1">Inventario General</h1>
          <p className="text-[#6F6F6E]">Vista administrativa — todos los laboratorios</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-5 border-b border-gray-200">
          <button
            onClick={() => setTabActiva("inventario")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tabActiva === "inventario"
                ? "border-[#C10230] text-[#C10230]"
                : "border-transparent text-[#6F6F6E] hover:text-gray-700"
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Inventario
          </button>
          <button
            onClick={() => setTabActiva("historial")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tabActiva === "historial"
                ? "border-[#C10230] text-[#C10230]"
                : "border-transparent text-[#6F6F6E] hover:text-gray-700"
            }`}
          >
            <History className="w-4 h-4" /> Historial de Movimientos
            {historial.length > 0 && (
              <span className="ml-1 bg-[#C10230] text-white text-xs px-1.5 py-0.5 rounded-full">{historial.length}</span>
            )}
          </button>
        </div>

        {/* ── TAB: INVENTARIO ── */}
        {tabActiva === "inventario" && (
          <>
            <Card className="mb-5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6F6E] w-4 h-4" />
                    <Input placeholder="Buscar por nombre, código o marca..." value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-10 text-sm" />
                  </div>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-48 h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FILTER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={labFilter} onValueChange={setLabFilter}>
                    <SelectTrigger className="w-36 h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LAB_OPTIONS.map((l) => (
                        <SelectItem key={l} value={l} className="text-sm">{l === "Todos" ? "Todos los labs" : l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                    <DialogTrigger asChild>
                      <Button className="bg-[#C10230] hover:bg-[#A21A19] h-10 gap-2 text-sm">
                        <Plus className="w-4 h-4" /> Nuevo Producto
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
                      <DialogHeader>
                        <DialogTitle className="text-[#C10230]">Nuevo Producto</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs">Tipo de Producto *</Label>
                            <Select value={form.tipo} onValueChange={(v) => f("tipo", v)}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="reactivo">Reactivo</SelectItem>
                                <SelectItem value="material">Material / Herramienta</SelectItem>
                                <SelectItem value="equipo">Equipo / Maquinaria</SelectItem>
                                <SelectItem value="insumo">Insumo / Consumible</SelectItem>
                                <SelectItem value="biologico">Materia Biológica</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Código</Label>
                            <Input value={generateCode(form.tipo, inventory.filter((i) => i.tipo === form.tipo).length + 1)}
                              disabled className="mt-1 bg-[#F5F6F8] font-mono text-sm" />
                          </div>
                        </div>
                        {isReactivo && (
                          <div className="grid grid-cols-2 gap-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                            <div>
                              <Label className="text-xs text-[#C10230] font-semibold">Estado Físico *</Label>
                              <Select value={form.estadoFisico} onValueChange={(v) => f("estadoFisico", v)}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="liquido">Líquido</SelectItem>
                                  <SelectItem value="solido">Sólido</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {form.estadoFisico === "liquido" && (
                              <div>
                                <Label className="text-xs text-[#C10230] font-semibold">Densidad (g/mL)</Label>
                                <Input type="number" step="0.001" value={form.densidad}
                                  onChange={(e) => f("densidad", e.target.value)} placeholder="1.000" className="mt-1" />
                              </div>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs">Nombre *</Label>
                            <Input value={form.nombre} onChange={(e) => f("nombre", e.target.value)}
                              placeholder="Nombre del producto" className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">Marca *</Label>
                            <Input value={form.marca} onChange={(e) => f("marca", e.target.value)}
                              placeholder="Fabricante / Marca" className="mt-1" />
                          </div>
                        </div>
                        {(isMaterial || isEquipo) && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs">Modelo</Label>
                              <Input value={form.modelo} onChange={(e) => f("modelo", e.target.value)} placeholder="Modelo" className="mt-1" />
                            </div>
                            {isEquipo && (
                              <div>
                                <Label className="text-xs">Número de Serie</Label>
                                <Input value={form.numeroSerie} onChange={(e) => f("numeroSerie", e.target.value)} placeholder="N/S" className="mt-1" />
                              </div>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs">Existencia *</Label>
                            <Input type="number" value={form.existencia}
                              onChange={(e) => f("existencia", e.target.value)} placeholder="0" className="mt-1" />
                          </div>
                          {!isEquipo && (
                            <div>
                              <Label className="text-xs">Unidad</Label>
                              {isMaterial ? (
                                <Select value={form.unidad} onValueChange={(v) => f("unidad", v)}>
                                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>{UNIDADES_MATERIAL.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                                </Select>
                              ) : isBiologico ? (
                                <Select value={form.unidad} onValueChange={(v) => f("unidad", v)}>
                                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>{UNIDADES_BIOLOGICO.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                                </Select>
                              ) : (
                                <Select value={form.unidad} onValueChange={(v) => f("unidad", v)}>
                                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ml">ml</SelectItem>
                                    <SelectItem value="L">L</SelectItem>
                                    <SelectItem value="g">g</SelectItem>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="Caja">Caja</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          )}
                          <div>
                            <Label className="text-xs">Stock mínimo</Label>
                            <Input type="number" value={form.stockMinimo}
                              onChange={(e) => f("stockMinimo", e.target.value)} placeholder="0" className="mt-1" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs">Fecha de Registro</Label>
                            <Input type="date" value={form.fechaRegistro}
                              onChange={(e) => f("fechaRegistro", e.target.value)} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">Almacén</Label>
                            {almacenOpts.length > 0 ? (
                              <Select value={form.almacen} onValueChange={(v) => f("almacen", v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                                <SelectContent>{almacenOpts.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : (
                              <Input value={form.almacen} onChange={(e) => f("almacen", e.target.value)} placeholder="Almacén" className="mt-1" />
                            )}
                          </div>
                        </div>
                        <Button onClick={handleSave} disabled={!formValid}
                          className="w-full bg-[#C10230] hover:bg-[#A21A19] gap-2">
                          <QrCode className="w-4 h-4" /> Guardar producto y generar QR
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[#C10230] text-base">
                  Todos los Productos
                  <span className="ml-2 text-sm font-normal text-[#6F6F6E]">({filtered.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm">Código</TableHead>
                      <TableHead className="text-sm">Nombre del producto</TableHead>
                      <TableHead className="text-sm">Tipo de producto</TableHead>
                      <TableHead className="text-sm">Existencia</TableHead>
                      <TableHead className="text-sm">Unidad</TableHead>
                      <TableHead className="text-sm">Laboratorio</TableHead>
                      <TableHead className="text-sm">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => {
                      const estado = calcularEstado(item);
                      const labColor = LAB_COLOR[item.ubicacion.laboratorio] ?? "#6F6F6E";
                      return (
                        <TableRow key={item.id}
                          className={`cursor-pointer transition-colors ${
                            selectedItem?.id === item.id ? "bg-red-50 border-l-4 border-l-[#C10230]" : "hover:bg-[#F5F6F8]"
                          }`}
                          onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}>
                          <TableCell className="font-mono font-semibold text-sm text-[#C10230]">{item.codigo}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{item.nombre}</p>
                            <p className="text-xs text-[#6F6F6E]">{item.marca}
                              {item.estadoFisico && <span className="ml-1 text-[#C10230]">· {item.estadoFisico === "liquido" ? "Líquido" : "Sólido"}</span>}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: TIPO_COLORS[item.tipo] }}>
                              {TIPO_ICONS[item.tipo]}{TIPO_LABELS[item.tipo]}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{item.existencia}</TableCell>
                          <TableCell className="text-sm text-[#6F6F6E]">{item.unidad ?? "—"}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                              style={{ backgroundColor: labColor }}>
                              {item.ubicacion.laboratorio}
                            </span>
                          </TableCell>
                          <TableCell><EstadoBadge estado={estado} /></TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-[#6F6F6E] text-sm">
                          No se encontraron productos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── TAB: HISTORIAL ── */}
        {tabActiva === "historial" && (
          <>
            <Card className="mb-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-[#C10230] text-base">Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-3">
                  <div>
                    <Label className="text-xs">Fecha inicio</Label>
                    <Input type="date" value={histFechaInicio}
                      onChange={(e) => setHistFechaInicio(e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha fin</Label>
                    <Input type="date" value={histFechaFin}
                      onChange={(e) => setHistFechaFin(e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de movimiento</Label>
                    <Select value={histTipoMov} onValueChange={setHistTipoMov}>
                      <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {Object.entries(MOV_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val} className="text-sm">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Laboratorio</Label>
                    <Select value={histLab} onValueChange={setHistLab}>
                      <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LAB_OPTIONS.map((l) => <SelectItem key={l} value={l} className="text-sm">{l === "Todos" ? "Todos" : l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs">Tipo de producto</Label>
                    <Select value={histTipoProd} onValueChange={setHistTipoProd}>
                      <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FILTER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[#C10230] text-base">
                  Historial de Movimientos
                  <span className="ml-2 text-sm font-normal text-[#6F6F6E]">({historialFiltrado.length} registros)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historialFiltrado.length === 0 ? (
                  <div className="text-center py-10 text-[#6F6F6E] text-sm">
                    <History className="w-10 h-10 mx-auto mb-3 opacity-25" />
                    <p className="font-medium">Sin movimientos</p>
                    <p className="text-xs mt-1">Ajuste los filtros de búsqueda</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-xs">Código</TableHead>
                          <TableHead className="text-xs">Producto</TableHead>
                          <TableHead className="text-xs">Tipo de movimiento</TableHead>
                          <TableHead className="text-xs">Cantidad</TableHead>
                          <TableHead className="text-xs">Exist. anterior</TableHead>
                          <TableHead className="text-xs">Exist. nueva</TableHead>
                          <TableHead className="text-xs">Responsable</TableHead>
                          <TableHead className="text-xs">Observaciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historialFiltrado.map((h) => {
                          const labColor = LAB_COLOR[h.laboratorio] ?? "#6F6F6E";
                          return (
                            <TableRow key={h.id} className="hover:bg-[#F5F6F8]">
                              <TableCell className="text-xs whitespace-nowrap font-medium">
                                {new Date(h.fecha + "T12:00").toLocaleDateString("es-MX")}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-[#C10230] font-semibold">{h.codigo}</TableCell>
                              <TableCell>
                                <p className="text-xs font-medium">{h.producto}</p>
                                <span className="text-xs" style={{ color: TIPO_COLORS[h.tipoProd] }}>{TIPO_LABELS[h.tipoProd]}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs whitespace-nowrap">
                                  {MOV_LABELS[h.tipoMovimiento]}
                                </Badge>
                              </TableCell>
                              <TableCell className={`text-xs font-mono font-semibold ${h.cantidad.startsWith("+") ? "text-green-600" : h.cantidad.startsWith("-") ? "text-red-600" : "text-gray-600"}`}>
                                {h.cantidad}
                              </TableCell>
                              <TableCell className="text-xs text-[#6F6F6E]">{h.existenciaAnterior}</TableCell>
                              <TableCell className="text-xs font-semibold">{h.existenciaNueva}</TableCell>
                              <TableCell className="text-xs">{h.responsable}</TableCell>
                              <TableCell className="text-xs text-[#6F6F6E] max-w-[160px]">
                                <p className="truncate" title={h.observaciones}>{h.observaciones || "—"}</p>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Side Detail Panel ── */}
      {selectedItem && tabActiva === "inventario" && (() => {
        const estado = calcularEstado(selectedItem);
        const labColor = LAB_COLOR[selectedItem.ubicacion.laboratorio] ?? "#6F6F6E";
        return (
          <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200 overflow-y-auto z-10 flex flex-col">
            {/* Panel header */}
            <div className="p-5 border-b border-gray-100 flex items-start gap-3"
              style={{ background: `linear-gradient(135deg, ${TIPO_COLORS[selectedItem.tipo]}08, #F5F6F8)` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: TIPO_COLORS[selectedItem.tipo] }}>
                {TIPO_ICONS[selectedItem.tipo]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight">{selectedItem.nombre}</p>
                <p className="text-xs font-mono text-[#C10230] mt-0.5">{selectedItem.codigo}</p>
                <span className="text-xs text-[#6F6F6E]">{TIPO_LABELS[selectedItem.tipo]}</span>
              </div>
              <button onClick={() => setSelectedItem(null)}
                className="text-[#6F6F6E] hover:text-gray-900 transition-colors flex-shrink-0 p-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Movimiento button */}
            <div className="p-4 border-b border-gray-100">
              <Button
                className="w-full bg-[#ED5E17] hover:bg-[#C10230] gap-2 text-sm"
                onClick={() => { resetMovimiento(); setShowMovDialog(true); }}
              >
                <ArrowRightLeft className="w-4 h-4" /> Registrar Movimiento
              </Button>
            </div>

            <div className="flex-1 p-5 space-y-5 overflow-y-auto">
              {/* Info */}
              <div>
                <h3 className="text-xs font-bold text-[#6F6F6E] uppercase tracking-wider mb-3">Información del Producto</h3>
                <div className="space-y-2">
                  {[
                    { label: "Código",     value: selectedItem.codigo },
                    { label: "Marca",      value: selectedItem.marca },
                    { label: "Existencia", value: `${selectedItem.existencia} ${selectedItem.unidad ?? ""}`.trim() },
                    { label: "Stock mín.", value: `${selectedItem.stockMinimo} ${selectedItem.unidad ?? ""}`.trim() },
                    ...(selectedItem.modelo      ? [{ label: "Modelo",   value: selectedItem.modelo }]      : []),
                    ...(selectedItem.numeroSerie ? [{ label: "N° Serie", value: selectedItem.numeroSerie }] : []),
                    ...(selectedItem.densidad    ? [{ label: "Densidad", value: `${selectedItem.densidad} g/mL` }] : []),
                    { label: "Registro",  value: new Date(selectedItem.fechaRegistro + "T12:00").toLocaleDateString("es-MX") },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="text-xs text-[#6F6F6E] w-24 flex-shrink-0">{label}</span>
                      <span className="text-xs font-medium text-gray-800 flex-1">{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-[#6F6F6E] w-24 flex-shrink-0">Estado</span>
                    <EstadoBadge estado={estado} />
                  </div>
                </div>
              </div>

              {/* Ubicación */}
              <div>
                <h3 className="text-xs font-bold text-[#6F6F6E] uppercase tracking-wider mb-3">Ubicación</h3>
                <div className="bg-[#F5F6F8] rounded-lg p-3 space-y-1.5">
                  {[
                    { label: "Laboratorio", value: selectedItem.ubicacion.laboratorio, color: labColor },
                    { label: "Almacén",     value: selectedItem.ubicacion.almacen },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-[#C10230] flex-shrink-0" />
                      <span className="text-xs text-[#6F6F6E] w-20">{label}:</span>
                      <span className="text-xs font-medium" style={color ? { color } : undefined}>{value || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* QR */}
              <div>
                <h3 className="text-xs font-bold text-[#6F6F6E] uppercase tracking-wider mb-3">Código QR</h3>
                <div className="flex flex-col items-center">
                  <QRBox codigo={selectedItem.codigo} nombre={selectedItem.nombre} />
                  <Button size="sm" variant="outline" className="mt-2 border-[#C10230] text-[#C10230] hover:bg-[#C10230] hover:text-white text-xs gap-1">
                    <Printer className="w-3 h-3" /> Imprimir etiqueta
                  </Button>
                </div>
              </div>

              {/* Historial interno del producto */}
              <div>
                <h3 className="text-xs font-bold text-[#6F6F6E] uppercase tracking-wider mb-3">Últimos Movimientos</h3>
                <div className="space-y-2">
                  {selectedItem.movHistorial.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C10230] mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 leading-snug">{h.accion}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs text-[#6F6F6E]">{new Date(h.fecha + "T12:00").toLocaleDateString("es-MX")}</span>
                          {h.cantidad && (
                            <span className={`text-xs font-mono font-semibold ${h.cantidad.includes("+") ? "text-green-600" : "text-red-600"}`}>
                              {h.cantidad}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Movimiento Dialog ── */}
      <Dialog open={showMovDialog} onOpenChange={(open) => { setShowMovDialog(open); if (!open) resetMovimiento(); }}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-[#C10230]">Movimiento de Inventario</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-2">
              {/* Info producto (solo lectura) */}
              <div className="p-3 bg-[#F5F6F8] rounded-lg grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  { label: "Código",     value: selectedItem.codigo },
                  { label: "Producto",   value: selectedItem.nombre },
                  { label: "Tipo",       value: TIPO_LABELS[selectedItem.tipo] },
                  { label: "Laboratorio",value: selectedItem.ubicacion.laboratorio },
                  { label: "Existencia actual", value: `${selectedItem.existencia} ${selectedItem.unidad ?? ""}`.trim() },
                  { label: "Stock mínimo", value: `${selectedItem.stockMinimo} ${selectedItem.unidad ?? ""}`.trim() },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-[#6F6F6E]">{label}</p>
                    <p className="text-xs font-semibold text-gray-800">{value}</p>
                  </div>
                ))}
                <div>
                  <p className="text-xs text-[#6F6F6E]">Estado</p>
                  <EstadoBadge estado={calcularEstado(selectedItem)} />
                </div>
              </div>

              {/* Tipo de movimiento */}
              <div>
                <Label className="text-xs">Tipo de movimiento *</Label>
                <Select value={movTipo} onValueChange={(v) => { setMovTipo(v as MovimientoTipo); setMovCantidad(""); setMovExistenciaFisica(""); setMovMotivo(""); setMovObs(""); setMovLabDestino(""); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada de inventario</SelectItem>
                    <SelectItem value="consumo_interno">Salida por consumo interno</SelectItem>
                    <SelectItem value="ajuste">Ajuste de inventario</SelectItem>
                    <SelectItem value="merma">Merma</SelectItem>
                    {(selectedItem.tipo === "reactivo" || selectedItem.tipo === "insumo") && (
                      <SelectItem value="caducado">Producto caducado</SelectItem>
                    )}
                    <SelectItem value="cambio_lab">Cambio de laboratorio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ENTRADA */}
              {movTipo === "entrada" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Cantidad recibida *</Label>
                      <Input type="number" value={movCantidad} onChange={(e) => setMovCantidad(e.target.value)}
                        placeholder="0" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Fecha</Label>
                      <Input type="date" value={movFecha} onChange={(e) => setMovFecha(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Observaciones</Label>
                    <Textarea value={movObs} onChange={(e) => setMovObs(e.target.value)}
                      placeholder="Proveedor, lote, etc." rows={2} className="mt-1 text-sm" />
                  </div>
                  {movCantidad && parseFloat(movCantidad) > 0 && (
                    <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                      Nueva existencia: <strong>{selectedItem.existencia + (parseFloat(movCantidad) || 0)} {selectedItem.unidad ?? ""}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* CONSUMO INTERNO */}
              {movTipo === "consumo_interno" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Cantidad *</Label>
                      <Input type="number" value={movCantidad} onChange={(e) => setMovCantidad(e.target.value)}
                        placeholder="0" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Fecha</Label>
                      <Input type="date" value={movFecha} onChange={(e) => setMovFecha(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Motivo *</Label>
                    <Input value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)}
                      placeholder="Motivo del consumo" className="mt-1" />
                  </div>
                  {movCantidad && parseFloat(movCantidad) > 0 && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      Nueva existencia: <strong>{Math.max(0, selectedItem.existencia - (parseFloat(movCantidad) || 0))} {selectedItem.unidad ?? ""}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* AJUSTE */}
              {movTipo === "ajuste" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Existencia física encontrada *</Label>
                    <Input type="number" value={movExistenciaFisica}
                      onChange={(e) => setMovExistenciaFisica(e.target.value)} placeholder="0" className="mt-1" />
                  </div>
                  {movExistenciaFisica !== "" && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                      Diferencia: <strong>
                        {(() => { const d = (parseFloat(movExistenciaFisica) || 0) - selectedItem.existencia; return `${d >= 0 ? "+" : ""}${d.toFixed(2)} ${selectedItem.unidad ?? ""}`; })()}
                      </strong>
                      {" · "}Nueva existencia: <strong>{parseFloat(movExistenciaFisica) || 0} {selectedItem.unidad ?? ""}</strong>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Motivo del ajuste</Label>
                    <Input value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)}
                      placeholder="Error de captura, conteo físico, etc." className="mt-1" />
                  </div>
                </div>
              )}

              {/* MERMA */}
              {movTipo === "merma" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Cantidad dañada *</Label>
                    <Input type="number" value={movCantidad} onChange={(e) => setMovCantidad(e.target.value)}
                      placeholder="0" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Motivo *</Label>
                    <Input value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)}
                      placeholder="Derrame, rotura, etc." className="mt-1" />
                  </div>
                  {movCantidad && parseFloat(movCantidad) > 0 && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                      Nueva existencia: <strong>{Math.max(0, selectedItem.existencia - (parseFloat(movCantidad) || 0))} {selectedItem.unidad ?? ""}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* CADUCADO */}
              {movTipo === "caducado" && soloReactivoInsumo && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Cantidad caducada *</Label>
                    <Input type="number" value={movCantidad} onChange={(e) => setMovCantidad(e.target.value)}
                      placeholder="0" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Observaciones</Label>
                    <Textarea value={movObs} onChange={(e) => setMovObs(e.target.value)}
                      placeholder="Fecha de caducidad, lote, etc." rows={2} className="mt-1 text-sm" />
                  </div>
                  {movCantidad && parseFloat(movCantidad) > 0 && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                      Nueva existencia: <strong>{Math.max(0, selectedItem.existencia - (parseFloat(movCantidad) || 0))} {selectedItem.unidad ?? ""}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* CAMBIO DE LABORATORIO */}
              {movTipo === "cambio_lab" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Laboratorio origen</Label>
                      <Input value={selectedItem.ubicacion.laboratorio} disabled className="mt-1 bg-[#F5F6F8] font-medium text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Laboratorio destino *</Label>
                      <Select value={movLabDestino} onValueChange={setMovLabDestino}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          {["N3", "N4", "LUM", "Electrónica"]
                            .filter((l) => l !== selectedItem.ubicacion.laboratorio)
                            .map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-[#6F6F6E] bg-[#F5F6F8] rounded p-2">
                    El producto conservará el mismo código QR y número de código. Solo se actualizará el laboratorio asignado.
                  </p>
                </div>
              )}

              {/* Fecha para movimientos que no tienen campo propio */}
              {(movTipo === "merma" || movTipo === "caducado" || movTipo === "ajuste" || movTipo === "cambio_lab") && (
                <div>
                  <Label className="text-xs">Fecha</Label>
                  <Input type="date" value={movFecha} onChange={(e) => setMovFecha(e.target.value)} className="mt-1" />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => { setShowMovDialog(false); resetMovimiento(); }}>
                  Cancelar
                </Button>
                <Button className="flex-1 bg-[#C10230] hover:bg-[#A21A19] gap-2" onClick={handleMovimiento}>
                  <ArrowRightLeft className="w-4 h-4" /> Guardar movimiento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
