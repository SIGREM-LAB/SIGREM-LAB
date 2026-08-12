import { useState } from "react";
import { Search, Plus, QrCode, Printer, X, ChevronRight, Package, Beaker, Microscope, Box, Leaf } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";

type ElementType = "reactivo" | "material" | "equipo" | "insumo" | "biologico";
type EstadoFisico = "liquido" | "solido";
type EstadoInventario = "disponible" | "stock_bajo" | "agotado" | "mantenimiento";

interface UbicacionFisica {
  laboratorio: string;
  almacen: string;
}

interface InventoryElement {
  id: string;
  codigo: string;
  nombre: string;
  marca: string;
  modelo?: string;
  numeroSerie?: string;
  descripcion: string;
  tipo: ElementType;
  estadoFisico?: EstadoFisico;
  existencia: number;
  unidad?: string;
  stockMinimo: number;
  densidad?: number;
  fechaRegistro: string;
  ubicacion: UbicacionFisica;
  estadoMantenimiento?: boolean;
  historial: { fecha: string; accion: string; cantidad: string }[];
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
  reactivo:  "Reactivo",
  material:  "Material / Herramienta",
  equipo:    "Equipo / Maquinaria",
  insumo:    "Insumo / Consumible",
  biologico: "Materia Biológica",
};

const TIPO_COLORS: Record<ElementType, string> = {
  reactivo:  "#C10230",
  material:  "#ED5E17",
  equipo:    "#2563EB",
  insumo:    "#16A34A",
  biologico: "#7C3AED",
};

const TIPO_ICONS: Record<ElementType, React.ReactNode> = {
  reactivo:  <Beaker className="w-4 h-4" />,
  material:  <Package className="w-4 h-4" />,
  equipo:    <Microscope className="w-4 h-4" />,
  insumo:    <Box className="w-4 h-4" />,
  biologico: <Leaf className="w-4 h-4" />,
};

const LAB_COLOR: Record<string, string> = {
  N3:          "#C10230",
  N4:          "#ED5E17",
  LUM:         "#2563EB",
  Electrónica: "#7C3AED",
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
  {
    id: "1", codigo: "REA-001", nombre: "Ácido Sulfúrico", marca: "Merck",
    descripcion: "H₂SO₄ 98% concentrado, grado reactivo", tipo: "reactivo",
    estadoFisico: "liquido", existencia: 1500, unidad: "ml", stockMinimo: 150,
    densidad: 1.84, fechaRegistro: "2026-01-15",
    ubicacion: { laboratorio: "N4", almacen: "Lab 5" },
    historial: [
      { fecha: "2026-06-20", accion: "Uso en práctica PRA-198", cantidad: "-45 ml" },
      { fecha: "2026-05-10", accion: "Entrada de inventario",   cantidad: "+500 ml" },
    ],
  },
  {
    id: "2", codigo: "REA-002", nombre: "Hidróxido de Sodio", marca: "J.T. Baker",
    descripcion: "NaOH grado reactivo, pellets", tipo: "reactivo",
    estadoFisico: "solido", existencia: 150, unidad: "g", stockMinimo: 200,
    fechaRegistro: "2026-02-01",
    ubicacion: { laboratorio: "N4", almacen: "Lab 6" },
    historial: [{ fecha: "2026-06-22", accion: "Uso en práctica PRA-201", cantidad: "-23.75 g" }],
  },
  {
    id: "3", codigo: "MAT-001", nombre: "Vaso de Precipitado 250 ml", marca: "Pyrex",
    modelo: "VAS-250",
    descripcion: "Cristalería de borosilicato", tipo: "material",
    existencia: 24, unidad: "Pieza", stockMinimo: 10, fechaRegistro: "2025-11-20",
    ubicacion: { laboratorio: "N3", almacen: "Lab 2" },
    historial: [
      { fecha: "2026-06-20", accion: "Entregado práctica PRA-198", cantidad: "-5 piezas" },
      { fecha: "2026-06-20", accion: "Devuelto práctica PRA-198",  cantidad: "+4 piezas" },
    ],
  },
  {
    id: "4", codigo: "EQU-001", nombre: "Balanza Analítica", marca: "Ohaus",
    modelo: "Pioneer PA224C", numeroSerie: "B417000341",
    descripcion: "Capacidad 220g, legibilidad 0.0001g", tipo: "equipo",
    existencia: 1, stockMinimo: 1, fechaRegistro: "2025-08-10",
    ubicacion: { laboratorio: "N4", almacen: "Lab 5" },
    historial: [
      { fecha: "2026-06-23", accion: "Préstamo práctica PRA-202", cantidad: "" },
      { fecha: "2026-06-23", accion: "Devolución en buen estado", cantidad: "" },
    ],
  },
  {
    id: "5", codigo: "INS-001", nombre: "Guantes de Nitrilo", marca: "Kimberly-Clark",
    descripcion: "Caja 100 piezas, talla M", tipo: "insumo",
    existencia: 0, unidad: "Caja", stockMinimo: 2, fechaRegistro: "2026-03-01",
    ubicacion: { laboratorio: "N3", almacen: "Lab 1" },
    historial: [{ fecha: "2026-06-18", accion: "Uso en práctica PRA-195", cantidad: "-1 caja" }],
  },
  {
    id: "6", codigo: "EQU-002", nombre: "pH-metro", marca: "Hanna",
    modelo: "HI2210", numeroSerie: "H2210-1234",
    descripcion: "Medición de pH con electrodo combinado", tipo: "equipo",
    existencia: 2, stockMinimo: 1, fechaRegistro: "2025-09-15",
    estadoMantenimiento: true,
    ubicacion: { laboratorio: "N3", almacen: "Lab 3" },
    historial: [{ fecha: "2026-07-01", accion: "Enviado a mantenimiento", cantidad: "" }],
  },
  {
    id: "7", codigo: "BIO-001", nombre: "Musgo Sphagnum", marca: "—",
    descripcion: "Muestra de briofita para análisis morfológico", tipo: "biologico",
    existencia: 45, unidad: "Fragmentos", stockMinimo: 10, fechaRegistro: "2026-04-10",
    ubicacion: { laboratorio: "LUM", almacen: "LUM" },
    historial: [{ fecha: "2026-04-10", accion: "Registro inicial", cantidad: "+45 Fragmentos" }],
  },
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

function autoStockMinimo(tipo: ElementType, existencia: number): number {
  if (tipo === "reactivo") return Math.ceil(existencia * 0.10);
  if (tipo === "insumo")   return Math.ceil(existencia * 0.20);
  return 0;
}

function QRBox({ codigo, nombre }: { codigo: string; nombre: string }) {
  const size = 120; const cells = 21; const cell = size / cells;
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
    <div className="flex flex-col items-center gap-2">
      <div className="border-2 border-[#C10230] rounded-lg p-3 bg-white">
        <svg width={size} height={size}>
          {grid.map((row, ri) => row.map((on, ci) => on
            ? <rect key={`${ri}-${ci}`} x={ci * cell} y={ri * cell} width={cell} height={cell} fill="#1a1a1a" />
            : null
          ))}
        </svg>
      </div>
      <p className="font-mono text-xs font-bold">{codigo}</p>
      <p className="text-xs text-[#6F6F6E] text-center max-w-[140px] truncate">{nombre}</p>
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
  tipo: ElementType;
  estadoFisico: EstadoFisico;
  nombre: string; marca: string; modelo: string; numeroSerie: string;
  descripcion: string; existencia: string; unidad: string;
  stockMinimo: string; stockMinimoAuto: boolean; densidad: string; fechaRegistro: string;
  almacen: string;
}
const EMPTY_FORM: FormState = {
  tipo: "reactivo", estadoFisico: "liquido",
  nombre: "", marca: "", modelo: "", numeroSerie: "",
  descripcion: "", existencia: "", unidad: "ml",
  stockMinimo: "", stockMinimoAuto: true, densidad: "", fechaRegistro: new Date().toISOString().split("T")[0],
  almacen: "",
};

export function Inventory() {
  const { user } = useAuth();
  const { estaEnUso } = useApp();
  const [filter, setFilter] = useState("todos");
  const [labFilter, setLabFilter] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [inventory, setInventory] = useState<InventoryElement[]>(SAMPLE);
  const [selectedItem, setSelectedItem] = useState<InventoryElement | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  const f = (key: keyof FormState, val: string | boolean) => {
    setForm((p) => {
      const next = { ...p, [key]: val };
      if (key === "existencia" && next.stockMinimoAuto) {
        const ex = parseFloat(val as string) || 0;
        next.stockMinimo = autoStockMinimo(next.tipo, ex).toString();
      }
      if (key === "tipo" && next.stockMinimoAuto) {
        const ex = parseFloat(next.existencia) || 0;
        next.stockMinimo = autoStockMinimo(val as ElementType, ex).toString();
        if (val === "reactivo") next.unidad = "ml";
        if (val === "material") next.unidad = "Pieza";
        if (val === "biologico") next.unidad = "Fragmentos";
      }
      return next;
    });
  };

  const isReactivo  = form.tipo === "reactivo";
  const isMaterial  = form.tipo === "material";
  const isEquipo    = form.tipo === "equipo";
  const isBiologico = form.tipo === "biologico";

  const filtered = inventory.filter((item) => {
    const estado = calcularEstado(item);
    if (estado === "agotado") return false;
    const matchFilter = filter === "todos" || item.tipo === filter;
    const matchLab    = labFilter === "Todos" || item.ubicacion.laboratorio === labFilter;
    const term = searchTerm.toLowerCase();
    const matchSearch = !term || item.nombre.toLowerCase().includes(term) ||
      item.codigo.toLowerCase().includes(term) || item.marca.toLowerCase().includes(term);
    return matchFilter && matchLab && matchSearch;
  });

  const canEdit = (item: InventoryElement) => item.ubicacion.laboratorio === user?.laboratorio;

  const almacenOpts = ALMACEN_OPTIONS[user?.laboratorio ?? ""] ?? [];

  function handleSave() {
    const count = inventory.filter((i) => i.tipo === form.tipo).length + 1;
    const codigo = generateCode(form.tipo, count);
    const existencia = parseFloat(form.existencia) || 0;
    const stockMinimo = form.stockMinimoAuto
      ? autoStockMinimo(form.tipo, existencia)
      : (parseFloat(form.stockMinimo) || 0);
    const el: InventoryElement = {
      id: Date.now().toString(), codigo,
      nombre: form.nombre, marca: form.marca,
      modelo: form.modelo || undefined,
      numeroSerie: isEquipo && form.numeroSerie ? form.numeroSerie : undefined,
      descripcion: form.descripcion, tipo: form.tipo,
      estadoFisico: isReactivo ? form.estadoFisico : undefined,
      existencia, unidad: isEquipo ? undefined : (form.unidad || undefined),
      stockMinimo,
      densidad: isReactivo && form.estadoFisico === "liquido" && form.densidad ? parseFloat(form.densidad) : undefined,
      fechaRegistro: form.fechaRegistro,
      ubicacion: { laboratorio: user?.laboratorio ?? "", almacen: form.almacen },
      historial: [{ fecha: form.fechaRegistro, accion: "Registro inicial", cantidad: `+${form.existencia} ${form.unidad || ""}`.trim() }],
    };
    setInventory((prev) => [...prev, el]);
    setSelectedItem(el);
    setShowDialog(false);
    setShowQRDialog(true);
    setForm({ ...EMPTY_FORM });
  }

  const formValid = form.nombre.trim() && form.marca.trim();

  return (
    <div className="flex h-full">
      {/* Main table area */}
      <div className={`flex-1 p-8 overflow-auto transition-all ${selectedItem ? "mr-80" : ""}`}>
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-[#C10230] mb-1">Inventario</h1>
          <p className="text-[#6F6F6E]">Gestión de productos — {user?.laboratorio}</p>
        </div>

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
                    <SelectItem key={l} value={l} className="text-sm">
                      {l === "Todos" ? "Todos los labs" : l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Dialog open={showDialog} onOpenChange={setShowDialog}>
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
                        <p className="text-xs text-[#6F6F6E] mt-0.5">Generado automáticamente</p>
                      </div>
                    </div>

                    {/* Estado físico — solo Reactivo */}
                    {isReactivo && (
                      <div className="grid grid-cols-2 gap-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                        <div>
                          <Label className="text-xs text-[#C10230] font-semibold">Estado Físico *</Label>
                          <Select value={form.estadoFisico} onValueChange={(v) => f("estadoFisico", v)}>
                            <SelectTrigger className="mt-1 border-[#C10230]/30"><SelectValue /></SelectTrigger>
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
                              onChange={(e) => f("densidad", e.target.value)} placeholder="1.000"
                              className="mt-1 border-[#C10230]/30" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Materia Biológica indicator */}
                    {isBiologico && (
                      <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg">
                        <p className="text-xs text-[#7C3AED] font-semibold">Materia Biológica — campos especiales</p>
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

                    {/* Modelo — Material y Equipo */}
                    {(isMaterial || isEquipo) && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Modelo</Label>
                          <Input value={form.modelo} onChange={(e) => f("modelo", e.target.value)}
                            placeholder="Modelo" className="mt-1" />
                        </div>
                        {/* Número de Serie solo para Equipo */}
                        {isEquipo && (
                          <div>
                            <Label className="text-xs">Número de Serie</Label>
                            <Input value={form.numeroSerie} onChange={(e) => f("numeroSerie", e.target.value)}
                              placeholder="N/S" className="mt-1" />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label className="text-xs">Descripción</Label>
                      <Textarea value={form.descripcion} onChange={(e) => f("descripcion", e.target.value)}
                        placeholder="Descripción del producto" rows={2} className="mt-1 text-sm" />
                    </div>

                    {/* Existencia, Unidad */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs">Existencia *</Label>
                        <Input type="number" value={form.existencia} onChange={(e) => f("existencia", e.target.value)}
                          placeholder="0" className="mt-1" />
                      </div>
                      {!isEquipo && (
                        <div>
                          <Label className="text-xs">Unidad</Label>
                          {isMaterial ? (
                            <Select value={form.unidad} onValueChange={(v) => f("unidad", v)}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {UNIDADES_MATERIAL.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : isBiologico ? (
                            <Select value={form.unidad} onValueChange={(v) => f("unidad", v)}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {UNIDADES_BIOLOGICO.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              </SelectContent>
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
                                <SelectItem value="Paquete">Paquete</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                      <div>
                        <Label className="text-xs flex items-center gap-1.5">
                          Stock mínimo
                          {(isReactivo || form.tipo === "insumo") && (
                            <span className="text-[10px] text-[#6F6F6E] font-normal">
                              ({isReactivo ? "10%" : "20%"} auto)
                            </span>
                          )}
                        </Label>
                        <Input type="number" value={form.stockMinimo}
                          onChange={(e) => { f("stockMinimo", e.target.value); setForm((p) => ({ ...p, stockMinimoAuto: false })); }}
                          placeholder="0" className="mt-1" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Fecha de Registro</Label>
                        <Input type="date" value={form.fechaRegistro}
                          onChange={(e) => f("fechaRegistro", e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Laboratorio</Label>
                        <Input value={user?.laboratorio ?? ""} disabled
                          className="mt-1 bg-[#F5F6F8] font-medium text-sm" />
                      </div>
                    </div>

                    {/* Ubicación — solo Almacén */}
                    <div>
                      <Label className="text-xs">Almacén *</Label>
                      {almacenOpts.length > 0 ? (
                        <Select value={form.almacen} onValueChange={(v) => f("almacen", v)}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                          <SelectContent>
                            {almacenOpts.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={form.almacen} onChange={(e) => f("almacen", e.target.value)}
                          placeholder="Almacén" className="mt-1 text-sm" />
                      )}
                    </div>

                    <Button onClick={handleSave} disabled={!formValid}
                      className="w-full bg-[#C10230] hover:bg-[#A21A19] gap-2">
                      <QrCode className="w-4 h-4" />
                      Guardar producto y generar QR
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
              Productos Registrados
              <span className="ml-2 text-sm font-normal text-[#6F6F6E]">({filtered.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm">Código</TableHead>
                  <TableHead className="text-sm">Nombre</TableHead>
                  <TableHead className="text-sm">Tipo</TableHead>
                  <TableHead className="text-sm">Existencia</TableHead>
                  <TableHead className="text-sm">Estado</TableHead>
                  <TableHead className="text-sm">Laboratorio</TableHead>
                  <TableHead className="text-sm">Almacén</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const estado = calcularEstado(item);
                  const enUso = estaEnUso(item.codigo);
                  const labColor = LAB_COLOR[item.ubicacion.laboratorio] ?? "#6F6F6E";
                  return (
                    <TableRow key={item.id}
                      className={`cursor-pointer transition-colors ${
                        selectedItem?.id === item.id ? "bg-red-50 border-l-4 border-l-[#C10230]" : "hover:bg-[#F5F6F8]"
                      }`}
                      onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                    >
                      <TableCell className="font-mono font-semibold text-sm text-[#C10230]">{item.codigo}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{item.nombre}</p>
                          <p className="text-xs text-[#6F6F6E]">{item.marca}
                            {item.estadoFisico && <span className="ml-1 text-[#C10230]">· {item.estadoFisico === "liquido" ? "Líquido" : "Sólido"}</span>}
                          </p>
                          {enUso && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                              En uso · {enUso}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs font-medium"
                          style={{ color: TIPO_COLORS[item.tipo] }}>
                          {TIPO_ICONS[item.tipo]}
                          {TIPO_LABELS[item.tipo]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {item.existencia} {item.unidad ?? ""}
                      </TableCell>
                      <TableCell><EstadoBadge estado={estado} /></TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: labColor }}>
                          {item.ubicacion.laboratorio}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-[#6F6F6E]">{item.ubicacion.almacen}</TableCell>
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
      </div>

      {/* Side Detail Panel */}
      {selectedItem && (() => {
        const estado = calcularEstado(selectedItem);
        const enUso  = estaEnUso(selectedItem.codigo);
        const labColor = LAB_COLOR[selectedItem.ubicacion.laboratorio] ?? "#6F6F6E";
        return (
          <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200 overflow-y-auto z-10 flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-start gap-3"
              style={{ background: `linear-gradient(135deg, ${TIPO_COLORS[selectedItem.tipo]}08, #F5F6F8)` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: TIPO_COLORS[selectedItem.tipo] }}>
                {TIPO_ICONS[selectedItem.tipo]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight">{selectedItem.nombre}</p>
                <p className="text-xs font-mono text-[#C10230] mt-0.5">{selectedItem.codigo}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#6F6F6E]">{TIPO_LABELS[selectedItem.tipo]}</span>
                  {selectedItem.estadoFisico && (
                    <span className="text-xs text-[#C10230] font-medium">
                      · {selectedItem.estadoFisico === "liquido" ? "Líquido" : "Sólido"}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)}
                className="text-[#6F6F6E] hover:text-gray-900 transition-colors flex-shrink-0 p-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-5 overflow-y-auto">
              {enUso && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700 font-semibold">En uso — {enUso}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Bloqueado hasta que se finalice la práctica.</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold text-[#6F6F6E] uppercase tracking-wider mb-3">Información General</h3>
                <div className="space-y-2">
                  {[
                    { label: "Marca",     value: selectedItem.marca },
                    { label: "Existencia",value: `${selectedItem.existencia} ${selectedItem.unidad ?? ""}`.trim() },
                    { label: "Stock mín.",value: `${selectedItem.stockMinimo} ${selectedItem.unidad ?? ""}`.trim() },
                    ...(selectedItem.modelo      ? [{ label: "Modelo",    value: selectedItem.modelo }]      : []),
                    ...(selectedItem.numeroSerie ? [{ label: "N° Serie",  value: selectedItem.numeroSerie }] : []),
                    ...(selectedItem.densidad    ? [{ label: "Densidad",  value: `${selectedItem.densidad} g/mL` }] : []),
                    { label: "Registro",  value: new Date(selectedItem.fechaRegistro + "T12:00").toLocaleDateString("es-MX") },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="text-xs text-[#6F6F6E] w-24 flex-shrink-0">{label}</span>
                      <span className="text-xs font-medium text-gray-800 flex-1">{value}</span>
                    </div>
                  ))}
                  {selectedItem.descripcion && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-[#6F6F6E] w-24 flex-shrink-0">Descripción</span>
                      <span className="text-xs text-gray-700 flex-1 leading-relaxed">{selectedItem.descripcion}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-[#6F6F6E] w-24 flex-shrink-0">Estado</span>
                    <EstadoBadge estado={estado} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-[#6F6F6E] uppercase tracking-wider mb-3">Ubicación Física</h3>
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

              <div>
                <h3 className="text-xs font-bold text-[#6F6F6E] uppercase tracking-wider mb-3">Código QR</h3>
                <div className="flex flex-col items-center">
                  <QRBox codigo={selectedItem.codigo} nombre={selectedItem.nombre} />
                  <Button size="sm" variant="outline" className="mt-3 border-[#C10230] text-[#C10230] hover:bg-[#C10230] hover:text-white text-xs gap-1">
                    <Printer className="w-3 h-3" /> Imprimir etiqueta
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-[#6F6F6E] uppercase tracking-wider mb-3">Historial de Movimientos</h3>
                <div className="space-y-2">
                  {selectedItem.historial.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C10230] mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 leading-snug">{h.accion}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs text-[#6F6F6E]">
                            {new Date(h.fecha + "T12:00").toLocaleDateString("es-MX")}
                          </span>
                          {h.cantidad && (
                            <span className={`text-xs font-mono font-semibold ${h.cantidad.startsWith("+") ? "text-green-600" : "text-red-600"}`}>
                              {h.cantidad}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!canEdit(selectedItem) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Este producto pertenece al laboratorio {selectedItem.ubicacion.laboratorio}. Puede consultarlo pero no modificarlo.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-[#C10230]">Producto Registrado</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-4 flex flex-col items-center">
              <QRBox codigo={selectedItem.codigo} nombre={selectedItem.nombre} />
              <p className="text-sm text-[#6F6F6E] text-center">{TIPO_LABELS[selectedItem.tipo]}</p>
              <Button className="w-full bg-[#C10230] hover:bg-[#A21A19] gap-2">
                <Printer className="w-4 h-4" /> Imprimir Etiqueta
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
