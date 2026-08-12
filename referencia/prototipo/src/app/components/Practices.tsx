import { useState } from "react";
import { useLocation } from "react-router";
import { QrCode, Search, Plus, Scale, Trash2, Package, Microscope, Box, CheckCircle2, Clock, FileText, Send, Beaker, Eye, Leaf, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";

type ElementType = "reactivo" | "material" | "equipo" | "insumo" | "biologico";
type ControlMethod = "peso" | "cantidad" | "prestamo" | "insumo" | "biologico";
type EstadoEquipo = "bueno" | "regular" | "dañado" | "mantenimiento";

const OBS_OPCIONES: Record<ElementType, string[]> = {
  reactivo:  ["No tenemos", "Contaminado", "Se terminó", "Préstamo N4", "Préstamo N3", "Préstamo LUM", "Otro"],
  material:  ["Material dañado", "Préstamo N4", "Préstamo N3", "Préstamo LUM", "Otro"],
  equipo:    ["Equipo dañado", "Préstamo N4", "Préstamo N3", "Préstamo LUM", "Otro"],
  insumo:    ["No tenemos", "Se terminó", "Material dañado", "Préstamo N4", "Préstamo N3", "Préstamo LUM", "Otro"],
  biologico: ["Material dañado", "Contaminado", "No tenemos", "Préstamo N4", "Préstamo N3", "Préstamo LUM", "Otro"],
};

// ── Full academic catalog: Program → Semestre → Asignaturas ─────────────────
const CATALOGO: Record<string, Record<string, string[]>> = {
  "Bachillerato Biología": {
    "4°": ["Ciencias de la Vida"],
    "5°": ["Biodiversidad"],
    "6°": ["Ecología y Desarrollo Sustentable"],
  },
  "Bachillerato Física": {
    "4°": ["El universo y su movimiento"],
    "5°": ["Campos y fuerzas"],
    "6°": ["Fenómenos físicos y tecnología"],
  },
  "Bachillerato Química": {
    "2°": ["Compuestos Químicos"],
    "3°": ["Transformaciones de la Materia"],
  },
  "Ingeniería Civil": {
    "1°": ["Química General"],
  },
  "Ingeniería en Geología Ambiental": {
    "1°": ["Química General"],
    "2°": ["Mineralogía", "Petrografía"],
    "3°": ["Geoquímica"],
    "4°": ["Análisis Ambiental"],
    "5°": ["Hidrogeología"],
    "8°": ["Remediación Ambiental"],
  },
  "Ingeniería en Materiales": {
    "1°": ["Química General"],
    "2°": ["Ciencia de Materiales"],
    "4°": ["Metalurgia Física"],
    "5°": ["Corrosión y Protección"],
    "6°": ["Polímeros"],
    "7°": ["Cerámicos"],
  },
  "Ingeniería Industrial": {
    "1°": ["Química General"],
    "4°": ["Termofluidos"],
  },
  "Ingeniería Minero Metalúrgica": {
    "1°": ["Química General"],
    "2°": ["Mineralogía"],
    "3°": ["Pirometalurgia"],
    "4°": ["Hidrometalurgia"],
    "5°": ["Análisis Instrumental"],
    "6°": ["Fundamentos de Metalurgia"],
    "7°": ["Control de Calidad Metalúrgico"],
  },
  "Licenciatura en Biología": {
    "1°": ["Biología Celular", "Química General"],
    "2°": ["Bioquímica"],
    "3°": ["Microbiología"],
    "4°": ["Genética"],
    "5°": ["Ecología"],
    "6°": ["Botánica"],
    "Optativa": ["Biología Marina", "Biotecnología"],
  },
  "Licenciatura en Química": {
    "1°": ["Química General I"],
    "2°": ["Química General II", "Química Inorgánica"],
    "3°": ["Química Analítica", "Fisicoquímica I"],
    "4°": ["Química Orgánica I", "Fisicoquímica II"],
    "5°": ["Química Orgánica II", "Análisis Instrumental"],
    "6°": ["Bioquímica"],
    "7°": ["Química Industrial"],
    "8°": ["Química Ambiental"],
  },
  "Química de Alimentos": {
    "1°": ["Química General"],
    "2°": ["Química Orgánica de Alimentos"],
    "3°": ["Bioquímica de Alimentos"],
    "4°": ["Análisis de Alimentos"],
    "5°": ["Microbiología de Alimentos"],
    "6°": ["Bromatología"],
    "7°": ["Control de Calidad Alimentario"],
    "8°": ["Tecnología de Alimentos"],
  },
};

function findSemestreForAsignatura(programa: string, asig: string): string {
  const sems = CATALOGO[programa] ?? {};
  return Object.entries(sems).find(([, asigs]) => asigs.includes(asig))?.[0] ?? "";
}

interface SearchElement {
  codigo: string; nombre: string; tipo: ElementType;
  laboratorio: string; existencia: string; ubicacion: string;
}

const ALL_ELEMENTS: SearchElement[] = [
  { codigo: "REA-001", nombre: "Ácido Sulfúrico",            tipo: "reactivo",  laboratorio: "N4",          existencia: "1500 ml",    ubicacion: "Lab 5" },
  { codigo: "REA-002", nombre: "Hidróxido de Sodio",         tipo: "reactivo",  laboratorio: "N4",          existencia: "150 g",      ubicacion: "Lab 6" },
  { codigo: "REA-003", nombre: "Etanol 96%",                 tipo: "reactivo",  laboratorio: "N3",          existencia: "2000 ml",    ubicacion: "Lab 2" },
  { codigo: "REA-004", nombre: "Ácido Clorhídrico",          tipo: "reactivo",  laboratorio: "N4",          existencia: "1200 ml",    ubicacion: "Lab 5" },
  { codigo: "MAT-001", nombre: "Vaso de Precipitado 250 ml", tipo: "material",  laboratorio: "N3",          existencia: "24 piezas",  ubicacion: "Lab 1" },
  { codigo: "MAT-002", nombre: "Pipeta Volumétrica 10 ml",   tipo: "material",  laboratorio: "N3",          existencia: "12 piezas",  ubicacion: "Lab 1" },
  { codigo: "MAT-003", nombre: "Matraz Erlenmeyer 500 ml",   tipo: "material",  laboratorio: "N4",          existencia: "18 piezas",  ubicacion: "Lab 7" },
  { codigo: "EQU-001", nombre: "Balanza Analítica Ohaus",    tipo: "equipo",    laboratorio: "N4",          existencia: "1 equipo",   ubicacion: "Lab 5" },
  { codigo: "EQU-002", nombre: "pH-metro Hanna HI2210",      tipo: "equipo",    laboratorio: "N3",          existencia: "2 equipos",  ubicacion: "Lab 3" },
  { codigo: "INS-001", nombre: "Guantes de Nitrilo (caja)",  tipo: "insumo",    laboratorio: "N3",          existencia: "3 cajas",    ubicacion: "Lab 2" },
  { codigo: "INS-002", nombre: "Papel filtro Whatman #1",    tipo: "insumo",    laboratorio: "N4",          existencia: "5 paquetes", ubicacion: "Lab 8" },
  { codigo: "BIO-001", nombre: "Musgo Sphagnum",             tipo: "biologico", laboratorio: "LUM",         existencia: "45 Fragmentos", ubicacion: "LUM" },
  { codigo: "EQU-003", nombre: "Osciloscopio Rigol DS1054Z", tipo: "equipo",    laboratorio: "Electrónica", existencia: "3 equipos",  ubicacion: "Electrónica" },
];

const TIPO_LABELS: Record<ElementType, string> = {
  reactivo: "Reactivo", material: "Material", equipo: "Equipo", insumo: "Insumo", biologico: "Mat. Biológica"
};
const TIPO_COLORS: Record<ElementType, string> = {
  reactivo: "#C10230", material: "#ED5E17", equipo: "#2563EB", insumo: "#16A34A", biologico: "#7C3AED"
};
const TIPO_ICONS: Record<ElementType, React.ReactNode> = {
  reactivo:  <Beaker className="w-4 h-4" />,
  material:  <Package className="w-4 h-4" />,
  equipo:    <Microscope className="w-4 h-4" />,
  insumo:    <Box className="w-4 h-4" />,
  biologico: <Leaf className="w-4 h-4" />,
};

const LAB_COLOR: Record<string, string> = {
  N3: "#C10230", N4: "#ED5E17", LUM: "#2563EB", Electrónica: "#7C3AED"
};

function defaultMetodo(tipo: ElementType): ControlMethod {
  if (tipo === "equipo")    return "prestamo";
  if (tipo === "material")  return "cantidad";
  if (tipo === "insumo")    return "insumo";
  if (tipo === "biologico") return "biologico";
  return "peso";
}

interface UsedElement {
  id: string; codigo: string; nombre: string; tipo: ElementType;
  laboratorio: string; existencia: string; ubicacion: string;
  metodoControl: ControlMethod;
  pesoInicial?: number; pesoFinal?: number; consumo?: number;
  cantidadEntregada?: number; cantidadDevuelta?: number; cantidadDanada?: number;
  estadoSalida?: EstadoEquipo; estadoDevolucion?: EstadoEquipo;
  cantidadUtilizada?: number; cantidadRestante?: number;
  obsSeleccionadas: string[]; obsDescripcion: string;
}

function isComplete(el: UsedElement): boolean {
  if (el.tipo === "equipo")    return !!el.estadoSalida;
  if (el.tipo === "material")  return (el.cantidadEntregada ?? 0) > 0;
  if (el.tipo === "insumo")    return (el.cantidadUtilizada ?? 0) > 0;
  if (el.tipo === "biologico") return (el.cantidadUtilizada ?? 0) > 0;
  return el.pesoInicial !== undefined && el.pesoFinal !== undefined;
}

function makeElement(src: SearchElement | Partial<UsedElement>): UsedElement {
  return {
    id: Date.now().toString() + Math.random(),
    codigo: src.codigo ?? "",
    nombre: src.nombre ?? "",
    tipo: (src.tipo as ElementType) ?? "reactivo",
    laboratorio: src.laboratorio ?? "",
    existencia: src.existencia ?? "",
    ubicacion: src.ubicacion ?? "",
    metodoControl: (src as any).metodoControl ?? defaultMetodo((src.tipo as ElementType) ?? "reactivo"),
    obsSeleccionadas: (src as any).obsSeleccionadas ?? [],
    obsDescripcion: (src as any).obsDescripcion ?? "",
    ...(src as Partial<UsedElement>),
  };
}

const SAMPLE_PRACTICA_ELEMENTS: Record<string, Partial<UsedElement>[]> = {
  "PRA-205": [
    { codigo: "REA-001", nombre: "Ácido Sulfúrico",         tipo: "reactivo", laboratorio: "N4", existencia: "1500 ml",  ubicacion: "Lab 5", metodoControl: "peso",     pesoInicial: 250.00, pesoFinal: 197.90, consumo: 52.10, obsSeleccionadas: [], obsDescripcion: "" },
    { codigo: "EQU-001", nombre: "Balanza Analítica Ohaus", tipo: "equipo",   laboratorio: "N4", existencia: "1 equipo", ubicacion: "Lab 5", metodoControl: "prestamo", estadoSalida: "bueno", estadoDevolucion: "bueno", obsSeleccionadas: [], obsDescripcion: "" },
  ],
  "PRA-204": [
    { codigo: "INS-001", nombre: "Guantes de Nitrilo (caja)",  tipo: "insumo",   laboratorio: "N3", existencia: "3 cajas",   ubicacion: "Lab 2", metodoControl: "insumo",   cantidadUtilizada: 1, obsSeleccionadas: [], obsDescripcion: "" },
    { codigo: "MAT-001", nombre: "Vaso de Precipitado 250 ml", tipo: "material", laboratorio: "N3", existencia: "24 piezas", ubicacion: "Lab 1", metodoControl: "cantidad", obsSeleccionadas: [], obsDescripcion: "" },
  ],
  "PRA-203": [
    { codigo: "REA-003", nombre: "Etanol 96%",                tipo: "reactivo", laboratorio: "N3", existencia: "2000 ml", ubicacion: "Lab 2", metodoControl: "peso",   pesoInicial: 500.00, pesoFinal: 401.35, consumo: 98.65, obsSeleccionadas: [], obsDescripcion: "" },
    { codigo: "INS-001", nombre: "Guantes de Nitrilo (caja)", tipo: "insumo",   laboratorio: "N3", existencia: "3 cajas", ubicacion: "Lab 2", metodoControl: "insumo", cantidadUtilizada: 1, cantidadRestante: 0, obsSeleccionadas: [], obsDescripcion: "" },
  ],
};

function ObsCheckboxes({ tipo, selected, onChange, disabled }: {
  tipo: ElementType; selected: string[];
  onChange: (v: string[]) => void; disabled?: boolean;
}) {
  function toggle(opt: string) {
    if (disabled) return;
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  }
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {OBS_OPCIONES[tipo].map((opt) => (
        <label key={opt}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          } ${selected.includes(opt) ? "bg-[#F5F6F8] font-medium text-gray-800" : "text-[#6F6F6E] hover:bg-gray-50"}`}>
          <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)}
            disabled={disabled} className="w-3.5 h-3.5" />
          {opt}
        </label>
      ))}
    </div>
  );
}

export function Practices() {
  const { user } = useAuth();
  const { marcarEnUso, liberar, liberarTodos, estaEnUso } = useApp();
  const location = useLocation();

  const incomingPractica = (location.state as any)?.practica as {
    numero: string; programaEducativo?: string; asignatura: string;
    laboratorio: string; fecha: string; hora?: string; estado: "en_proceso" | "finalizada";
  } | undefined;

  const readOnly = incomingPractica?.estado === "finalizada";

  const [practiceNumber, setPracticeNumber] = useState(incomingPractica?.numero ?? "PRA-001");
  const [programaEducativo, setProgramaEducativo] = useState(incomingPractica?.programaEducativo ?? "");
  const [semestre, setSemestre] = useState(
    incomingPractica && incomingPractica.programaEducativo
      ? findSemestreForAsignatura(incomingPractica.programaEducativo, incomingPractica.asignatura)
      : ""
  );
  const [asignatura, setAsignatura] = useState(incomingPractica?.asignatura ?? "");
  const [currentDate] = useState(incomingPractica?.fecha ?? new Date().toISOString().split("T")[0]);

  const preloadedEls = incomingPractica
    ? (SAMPLE_PRACTICA_ELEMENTS[incomingPractica.numero] ?? []).map((e, i) =>
        ({ ...makeElement(e as any), id: `preload-${i}` }))
    : [];

  const [usedElements, setUsedElements] = useState<UsedElement[]>(preloadedEls);
  const [selectedElement, setSelectedElement] = useState<UsedElement | null>(
    preloadedEls.length > 0 ? preloadedEls[0] : null
  );
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const semestreOpts = programaEducativo ? Object.keys(CATALOGO[programaEducativo] ?? {}) : [];
  const asignaturas  = (programaEducativo && semestre) ? (CATALOGO[programaEducativo]?.[semestre] ?? []) : [];

  // Determine labs accessible for search
  const prestamoLabs = usedElements.flatMap((el) =>
    el.obsSeleccionadas
      .filter((o) => o.startsWith("Préstamo "))
      .map((o) => o.replace("Préstamo ", ""))
  );
  const allowedLabs = [...new Set([user?.laboratorio, ...prestamoLabs].filter(Boolean))];

  const filteredSearch = ALL_ELEMENTS.filter((e) => {
    const matchLab  = allowedLabs.includes(e.laboratorio);
    const term = searchTerm.toLowerCase();
    const matchTerm = !searchTerm || e.nombre.toLowerCase().includes(term) || e.codigo.toLowerCase().includes(term);
    return matchLab && matchTerm;
  });

  function handleAdd(src: SearchElement) {
    if (usedElements.find((e) => e.codigo === src.codigo)) {
      toast.warning("Este producto ya está en la lista");
      return;
    }
    const enUsoPractica = estaEnUso(src.codigo);
    if (enUsoPractica) {
      toast.error(`Producto bloqueado — en uso en ${enUsoPractica}`);
      return;
    }
    const el = makeElement(src);
    setUsedElements((prev) => [...prev, el]);
    marcarEnUso(src.codigo, practiceNumber);
    setSelectedElement(el);
    setShowSearchDialog(false);
    setSearchTerm("");
  }

  function handleRemove(id: string) {
    const el = usedElements.find((e) => e.id === id);
    if (el) liberar(el.codigo);
    setUsedElements((prev) => prev.filter((e) => e.id !== id));
    if (selectedElement?.id === id) setSelectedElement(null);
  }

  function update(id: string, changes: Partial<UsedElement>) {
    setUsedElements((prev) => prev.map((e) => e.id === id ? { ...e, ...changes } : e));
    setSelectedElement((prev) => prev?.id === id ? { ...prev, ...changes } : prev);
  }

  function handleDraft() {
    if (!programaEducativo || !asignatura) { toast.error("Complete el programa educativo y asignatura"); return; }
    toast.success("Borrador guardado", { description: `${practiceNumber} · ${asignatura}` });
  }

  function handleFinalize() {
    if (!programaEducativo || !asignatura) { toast.error("Complete el programa educativo y asignatura"); return; }
    if (usedElements.length === 0) { toast.error("Agregue al menos un producto"); return; }
    const inc = usedElements.filter((e) => !isComplete(e));
    if (inc.length > 0) { toast.warning(`${inc.length} producto(s) pendientes de completar`); return; }
    liberarTodos(usedElements.map((e) => e.codigo));
    toast.success("Práctica finalizada", { description: `${practiceNumber} · ${asignatura}` });
    const n = parseInt(practiceNumber.replace("PRA-", "")) + 1;
    setPracticeNumber(`PRA-${n.toString().padStart(3, "0")}`);
    setProgramaEducativo(""); setSemestre(""); setAsignatura("");
    setUsedElements([]); setSelectedElement(null);
  }

  const sel        = selectedElement;
  const isReactivo  = sel?.tipo === "reactivo";
  const isMaterial  = sel?.tipo === "material";
  const isEquipo    = sel?.tipo === "equipo";
  const isInsumo    = sel?.tipo === "insumo";
  const isBiologico = sel?.tipo === "biologico";

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-bold text-[#C10230]">
              {readOnly ? "Consulta de Práctica" : "Registro de Práctica"}
            </h1>
            {readOnly && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                <Eye className="w-3.5 h-3.5" /> Solo lectura · Finalizada
              </span>
            )}
            {incomingPractica?.estado === "en_proceso" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3.5 h-3.5" /> En proceso
              </span>
            )}
          </div>
          <p className="text-[#6F6F6E]">Laboratorio: {user?.labCompleto}</p>
        </div>
        {!readOnly && (
          <div className="flex gap-3">
            <Button variant="outline" className="border-[#ED5E17] text-[#ED5E17] hover:bg-[#ED5E17] hover:text-white gap-2" onClick={handleDraft}>
              <FileText className="w-4 h-4" /> Guardar borrador
            </Button>
            <Button className="bg-[#C10230] hover:bg-[#A21A19] gap-2" onClick={handleFinalize}>
              <Send className="w-4 h-4" /> Finalizar práctica
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left 2/3 */}
        <div className="col-span-2 space-y-5">

          {/* Datos de la Práctica */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[#C10230] text-base">Datos de la Práctica</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* Programa */}
                <div>
                  <Label className="text-xs">Programa Educativo</Label>
                  {readOnly ? (
                    <Input value={programaEducativo} disabled className="mt-1 bg-[#F5F6F8] text-sm" />
                  ) : (
                    <Select value={programaEducativo} onValueChange={(v) => { setProgramaEducativo(v); setSemestre(""); setAsignatura(""); }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar programa" /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(CATALOGO).map((p) => (
                          <SelectItem key={p} value={p} className="text-sm">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Semestre */}
                <div>
                  <Label className="text-xs">Semestre</Label>
                  {readOnly ? (
                    <Input value={semestre} disabled className="mt-1 bg-[#F5F6F8] text-sm" />
                  ) : (
                    <Select value={semestre} onValueChange={(v) => { setSemestre(v); setAsignatura(""); }} disabled={!programaEducativo}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={programaEducativo ? "Seleccionar semestre" : "Seleccione programa primero"} />
                      </SelectTrigger>
                      <SelectContent>
                        {semestreOpts.map((s) => <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Asignatura */}
                <div>
                  <Label className="text-xs">Asignatura</Label>
                  {readOnly ? (
                    <Input value={asignatura} disabled className="mt-1 bg-[#F5F6F8] text-sm" />
                  ) : (
                    <Select value={asignatura} onValueChange={setAsignatura} disabled={!semestre}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={semestre ? "Seleccionar asignatura" : "Seleccione semestre primero"} />
                      </SelectTrigger>
                      <SelectContent>
                        {asignaturas.map((a) => <SelectItem key={a} value={a} className="text-sm">{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label className="text-xs">Número de Práctica</Label>
                  <Input value={practiceNumber} onChange={(e) => setPracticeNumber(e.target.value)}
                    disabled={readOnly} placeholder="PRA-001"
                    className={`mt-1 font-mono font-bold ${readOnly ? "bg-[#F5F6F8]" : ""}`} />
                </div>

                <div>
                  <Label className="text-xs">Laboratorio</Label>
                  <Input value={user?.labCompleto ?? ""} disabled className="mt-1 bg-[#F5F6F8] font-medium text-sm" />
                </div>

                <div>
                  <Label className="text-xs">Fecha</Label>
                  <Input value={new Date(currentDate + "T12:00").toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    disabled className="mt-1 bg-[#F5F6F8] text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agregar Productos */}
          {!readOnly && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[#C10230] text-base">Agregar Productos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button size="lg" className="bg-[#ED5E17] hover:bg-[#C10230] h-14 gap-2"
                    onClick={() => toast.info("Conecte el lector de QR — los productos de otros laboratorios pueden agregarse por préstamo")}>
                    <QrCode className="w-5 h-5" /> Escanear QR
                  </Button>

                  <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
                    <DialogTrigger asChild>
                      <Button size="lg" variant="outline" className="h-14 border-[#ED5E17] text-[#ED5E17] hover:bg-[#ED5E17] hover:text-white gap-2">
                        <Search className="w-5 h-5" /> Buscar producto
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl" aria-describedby={undefined}>
                      <DialogHeader>
                        <DialogTitle className="text-[#C10230]">Buscar Producto</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 py-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6F6E] w-4 h-4" />
                          <Input placeholder="Código o nombre..." value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" autoFocus />
                        </div>
                        <div className="flex flex-wrap gap-1.5 px-1">
                          {allowedLabs.map((lab) => (
                            <span key={lab} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                              style={{ backgroundColor: LAB_COLOR[lab!] ?? "#6F6F6E" }}>
                              {lab}
                            </span>
                          ))}
                          {prestamoLabs.length > 0 && (
                            <span className="text-xs text-[#6F6F6E] self-center">+{prestamoLabs.length} lab(s) por préstamo</span>
                          )}
                        </div>
                        <div className="space-y-2 max-h-[380px] overflow-y-auto">
                          {filteredSearch.length === 0 ? (
                            <p className="text-center text-[#6F6F6E] py-8 text-sm">
                              {searchTerm ? "Sin resultados" : "No hay productos disponibles"}
                            </p>
                          ) : filteredSearch.map((el) => {
                            const bloqueado = estaEnUso(el.codigo);
                            return (
                              <div key={el.codigo}
                                className={`p-3 border border-gray-200 rounded-lg transition-colors ${bloqueado ? "opacity-60 cursor-not-allowed bg-gray-50" : "hover:bg-[#F5F6F8] hover:border-[#C10230] cursor-pointer"}`}
                                onClick={() => !bloqueado && handleAdd(el)}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-mono text-xs text-[#C10230] font-semibold">{el.codigo}</span>
                                      <span className="text-xs px-1.5 py-0.5 rounded border"
                                        style={{ color: TIPO_COLORS[el.tipo], borderColor: TIPO_COLORS[el.tipo] + "50" }}>
                                        {TIPO_LABELS[el.tipo]}
                                      </span>
                                    </div>
                                    <p className="font-medium text-sm truncate">{el.nombre}</p>
                                    <p className="text-xs text-[#6F6F6E] mt-0.5">{el.laboratorio} · {el.existencia}</p>
                                    <p className="text-xs text-[#6F6F6E]">{el.ubicacion}</p>
                                    {bloqueado && (
                                      <p className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                                        <AlertCircle className="w-3 h-3" /> En uso — {bloqueado}
                                      </p>
                                    )}
                                  </div>
                                  {!bloqueado && <Plus className="w-4 h-4 text-[#C10230] flex-shrink-0 mt-1" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla de Productos Utilizados */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[#C10230] text-base">
                Productos Utilizados
                {usedElements.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-[#6F6F6E]">
                    ({usedElements.filter(isComplete).length}/{usedElements.length} completados)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usedElements.length === 0 ? (
                <div className="text-center py-10 text-[#6F6F6E]">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm font-medium">Sin productos</p>
                  <p className="text-xs mt-1">Use el escáner QR o búsqueda manual para agregar productos</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm">Código</TableHead>
                      <TableHead className="text-sm">Nombre</TableHead>
                      <TableHead className="text-sm">Tipo</TableHead>
                      <TableHead className="text-sm">Método</TableHead>
                      <TableHead className="text-sm">Estado</TableHead>
                      {!readOnly && <TableHead className="w-8" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usedElements.map((el) => (
                      <TableRow key={el.id}
                        className={`cursor-pointer transition-colors ${
                          selectedElement?.id === el.id ? "bg-red-50 border-l-4 border-l-[#C10230]" : "hover:bg-[#F5F6F8]"
                        }`}
                        onClick={() => setSelectedElement(selectedElement?.id === el.id ? null : el)}>
                        <TableCell className="font-mono text-xs font-semibold text-[#C10230]">{el.codigo}</TableCell>
                        <TableCell className="text-sm font-medium">{el.nombre}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: TIPO_COLORS[el.tipo] }}>
                            {TIPO_ICONS[el.tipo]} {TIPO_LABELS[el.tipo]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {el.metodoControl === "peso" ? "Peso" : el.metodoControl === "cantidad" ? "Cantidad" : el.metodoControl === "prestamo" ? "Préstamo" : el.metodoControl === "biologico" ? "Biológico" : "Uso"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isComplete(el) ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Completado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500">
                              <Clock className="w-3.5 h-3.5" /> Pendiente
                            </span>
                          )}
                        </TableCell>
                        {!readOnly && (
                          <TableCell>
                            <button onClick={(e) => { e.stopPropagation(); handleRemove(el.id); }}
                              className="text-[#6F6F6E] hover:text-[#A21A19] transition-colors p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1/3: Panel Dinámico */}
        <div className="col-span-1">
          <Card className="sticky top-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#C10230] text-base">
                {readOnly ? "Detalle del Producto" : "Panel de Control"}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-220px)] overflow-y-auto">
              {!sel ? (
                <div className="text-center py-10 text-[#6F6F6E]">
                  <Package className="w-9 h-9 mx-auto mb-3 opacity-25" />
                  <p className="text-sm font-medium">Seleccione un producto</p>
                  <p className="text-xs mt-1 leading-relaxed">Haga clic en una fila de la tabla</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg border-l-4 flex items-start gap-2.5"
                    style={{ borderLeftColor: TIPO_COLORS[sel.tipo], background: TIPO_COLORS[sel.tipo] + "08" }}>
                    <div className="w-8 h-8 rounded flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: TIPO_COLORS[sel.tipo] }}>
                      {TIPO_ICONS[sel.tipo]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 leading-tight truncate">{sel.nombre}</p>
                      <p className="text-xs font-mono" style={{ color: TIPO_COLORS[sel.tipo] }}>{sel.codigo}</p>
                      <p className="text-xs text-[#6F6F6E]">{sel.laboratorio} · {sel.existencia}</p>
                    </div>
                  </div>

                  {/* REACTIVO */}
                  {isReactivo && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#C10230] text-white rounded-lg">
                        <Scale className="w-4 h-4" /><span className="text-sm font-medium">Control por Peso</span>
                      </div>
                      {[
                        { key: "pesoInicial" as const, label: "Peso Inicial (g)" },
                        { key: "pesoFinal"   as const, label: "Peso Final (g)"   },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label className="text-xs">{label}</Label>
                          <div className="flex gap-2 mt-1">
                            <Input type="number" step="0.01" value={sel[key] ?? ""} placeholder="0.00"
                              disabled={readOnly} className={`h-9 ${readOnly ? "bg-[#F5F6F8]" : ""}`}
                              onChange={(e) => {
                                const v  = parseFloat(e.target.value) || 0;
                                const pi = key === "pesoInicial" ? v : (sel.pesoInicial ?? 0);
                                const pf = key === "pesoFinal"   ? v : (sel.pesoFinal   ?? 0);
                                update(sel.id, { [key]: v, consumo: pi - pf });
                              }} />
                            {!readOnly && (
                              <Button variant="outline" size="sm" className="h-9 px-2 border-[#C10230] text-[#C10230]" title="Leer balanza">
                                <Scale className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="p-3 bg-[#F5F6F8] rounded-lg">
                        <p className="text-xs text-[#6F6F6E]">Consumo calculado</p>
                        <p className="text-2xl font-bold text-[#C10230]">{Math.max(0, sel.consumo ?? 0).toFixed(2)} g</p>
                      </div>
                    </div>
                  )}

                  {/* MATERIAL */}
                  {isMaterial && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#ED5E17] text-white rounded-lg">
                        <Package className="w-4 h-4" /><span className="text-sm font-medium">Control por Cantidad</span>
                      </div>
                      {[
                        { key: "cantidadEntregada" as const, label: "Cantidad Entregada" },
                        { key: "cantidadDevuelta"  as const, label: "Cantidad Devuelta"  },
                        { key: "cantidadDanada"    as const, label: "Cantidad Dañada"    },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label className="text-xs">{label}</Label>
                          <Input type="number" value={sel[key] ?? ""} placeholder="0"
                            disabled={readOnly} className={`h-9 mt-1 ${readOnly ? "bg-[#F5F6F8]" : ""}`}
                            onChange={(e) => update(sel.id, { [key]: parseInt(e.target.value) || 0 })} />
                        </div>
                      ))}
                      <div className="p-3 bg-[#F5F6F8] rounded-lg">
                        <p className="text-xs text-[#6F6F6E]">Pérdidas calculadas</p>
                        <p className="text-2xl font-bold text-[#ED5E17]">
                          {Math.max(0, (sel.cantidadEntregada ?? 0) - (sel.cantidadDevuelta ?? 0) - (sel.cantidadDanada ?? 0))} piezas
                        </p>
                      </div>
                    </div>
                  )}

                  {/* EQUIPO */}
                  {isEquipo && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#2563EB] text-white rounded-lg">
                        <Microscope className="w-4 h-4" /><span className="text-sm font-medium">Control por Préstamo</span>
                      </div>
                      {[
                        { key: "estadoSalida"     as const, label: "Estado de Salida"     },
                        { key: "estadoDevolucion" as const, label: "Estado de Devolución" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label className="text-xs">{label}</Label>
                          {readOnly ? (
                            <Input value={sel[key] ?? "—"} disabled className="mt-1 h-9 bg-[#F5F6F8] capitalize" />
                          ) : (
                            <Select value={sel[key] ?? ""} onValueChange={(v: EstadoEquipo) => update(sel.id, { [key]: v })}>
                              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bueno">Bueno</SelectItem>
                                <SelectItem value="regular">Regular</SelectItem>
                                <SelectItem value="dañado">Dañado</SelectItem>
                                <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* INSUMO */}
                  {isInsumo && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#16A34A] text-white rounded-lg">
                        <Box className="w-4 h-4" /><span className="text-sm font-medium">Control de Insumo</span>
                      </div>
                      {[
                        { key: "cantidadUtilizada" as const, label: "Cantidad Utilizada" },
                        { key: "cantidadRestante"  as const, label: "Cantidad Restante"  },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label className="text-xs">{label}</Label>
                          <Input type="number" value={sel[key] ?? ""} placeholder="0"
                            disabled={readOnly} className={`h-9 mt-1 ${readOnly ? "bg-[#F5F6F8]" : ""}`}
                            onChange={(e) => update(sel.id, { [key]: parseFloat(e.target.value) || 0 })} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* MATERIA BIOLÓGICA */}
                  {isBiologico && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#7C3AED] text-white rounded-lg">
                        <Leaf className="w-4 h-4" /><span className="text-sm font-medium">Control Biológico</span>
                      </div>
                      {[
                        { key: "cantidadUtilizada" as const, label: "Cantidad Utilizada" },
                        { key: "cantidadRestante"  as const, label: "Cantidad Restante"  },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label className="text-xs">{label}</Label>
                          <Input type="number" value={sel[key] ?? ""} placeholder="0"
                            disabled={readOnly} className={`h-9 mt-1 ${readOnly ? "bg-[#F5F6F8]" : ""}`}
                            onChange={(e) => update(sel.id, { [key]: parseFloat(e.target.value) || 0 })} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Observaciones */}
                  <div className="space-y-2 pt-1">
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs font-semibold text-[#6F6F6E] uppercase tracking-wide mb-2">Observaciones</p>
                      <ObsCheckboxes
                        tipo={sel.tipo}
                        selected={sel.obsSeleccionadas}
                        onChange={(v) => update(sel.id, { obsSeleccionadas: v })}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#6F6F6E]">Descripción adicional</Label>
                      <Textarea value={sel.obsDescripcion} placeholder="Observaciones adicionales..."
                        rows={2} disabled={readOnly}
                        className={`mt-1 text-xs resize-none ${readOnly ? "bg-[#F5F6F8]" : ""}`}
                        onChange={(e) => update(sel.id, { obsDescripcion: e.target.value })} />
                    </div>
                  </div>

                  {readOnly ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      <Eye className="w-4 h-4" /> Modo consulta — solo lectura
                    </div>
                  ) : (
                    <div className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold ${
                      isComplete(sel) ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {isComplete(sel)
                        ? <><CheckCircle2 className="w-4 h-4" /> Producto completado</>
                        : <><Clock className="w-4 h-4" /> Complete los campos requeridos</>}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
