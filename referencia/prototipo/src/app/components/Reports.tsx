import { useState } from "react";
import { FileDown, FileSpreadsheet, Filter } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { toast } from "sonner";

const PROGRAMAS = [
  "Todos",
  "Bachillerato Biología",
  "Bachillerato Física",
  "Bachillerato Química",
  "Ingeniería Civil",
  "Ingeniería en Geología Ambiental",
  "Ingeniería en Materiales",
  "Ingeniería Industrial",
  "Ingeniería Minero Metalúrgica",
  "Licenciatura en Biología",
  "Licenciatura en Química",
  "Química de Alimentos",
];

const LABORATORIOS = ["Todos", "N3", "N4", "LUM", "Electrónica"];

const LAB_COLOR: Record<string, string> = {
  N3:          "#C10230",
  N4:          "#ED5E17",
  LUM:         "#2563EB",
  Electrónica: "#7C3AED",
};

const TIPO_BADGE_STYLE: Record<string, string> = {
  "Reactivo":         "bg-red-50 text-[#C10230] border-[#C10230]",
  "Material":         "bg-orange-50 text-[#ED5E17] border-[#ED5E17]",
  "Equipo":           "bg-blue-50 text-[#2563EB] border-[#2563EB]",
  "Insumo":           "bg-green-50 text-[#16A34A] border-[#16A34A]",
  "Materia Biológica":"bg-purple-50 text-[#7C3AED] border-[#7C3AED]",
};

interface ReportRecord {
  id: string; fecha: string; programaEducativo: string; asignatura: string;
  codigo: string; producto: string; tipo: string; consumo: string; unidad: string;
  laboratorio: string; practica: string;
}

const SAMPLE_DATA: ReportRecord[] = [
  { id: "1",  fecha: "2026-06-20", programaEducativo: "Licenciatura en Química",       asignatura: "Química General I",         codigo: "REA-001", producto: "Ácido Sulfúrico",            tipo: "Reactivo",  consumo: "45.50", unidad: "ml",      laboratorio: "N4",          practica: "PRA-198" },
  { id: "2",  fecha: "2026-06-20", programaEducativo: "Licenciatura en Química",       asignatura: "Química General I",         codigo: "MAT-001", producto: "Vaso de Precipitado 250 ml", tipo: "Material",  consumo: "5",     unidad: "piezas",  laboratorio: "N3",          practica: "PRA-198" },
  { id: "3",  fecha: "2026-06-21", programaEducativo: "Licenciatura en Biología",      asignatura: "Microbiología",             codigo: "EQU-001", producto: "Balanza Analítica",          tipo: "Equipo",    consumo: "Préstamo", unidad: "",     laboratorio: "N4",          practica: "PRA-199" },
  { id: "4",  fecha: "2026-06-21", programaEducativo: "Química de Alimentos",          asignatura: "Análisis de Alimentos",     codigo: "REA-003", producto: "Etanol 96%",                 tipo: "Reactivo",  consumo: "125.30",unidad: "ml",      laboratorio: "N3",          practica: "PRA-200" },
  { id: "5",  fecha: "2026-06-22", programaEducativo: "Ingeniería Minero Metalúrgica", asignatura: "Mineralogía",               codigo: "REA-002", producto: "Hidróxido de Sodio",         tipo: "Reactivo",  consumo: "23.75", unidad: "g",       laboratorio: "N4",          practica: "PRA-201" },
  { id: "6",  fecha: "2026-06-22", programaEducativo: "Ingeniería Minero Metalúrgica", asignatura: "Mineralogía",               codigo: "MAT-002", producto: "Pipeta Volumétrica 10 ml",   tipo: "Material",  consumo: "3",     unidad: "piezas",  laboratorio: "N3",          practica: "PRA-201" },
  { id: "7",  fecha: "2026-06-23", programaEducativo: "Licenciatura en Química",       asignatura: "Química Analítica",         codigo: "REA-001", producto: "Ácido Sulfúrico",            tipo: "Reactivo",  consumo: "52.10", unidad: "ml",      laboratorio: "N4",          practica: "PRA-202" },
  { id: "8",  fecha: "2026-06-23", programaEducativo: "Licenciatura en Química",       asignatura: "Química Analítica",         codigo: "EQU-001", producto: "Balanza Analítica",          tipo: "Equipo",    consumo: "Préstamo", unidad: "",     laboratorio: "N4",          practica: "PRA-202" },
  { id: "9",  fecha: "2026-06-24", programaEducativo: "Licenciatura en Biología",      asignatura: "Bioquímica",                codigo: "REA-003", producto: "Etanol 96%",                 tipo: "Reactivo",  consumo: "98.65", unidad: "ml",      laboratorio: "N3",          practica: "PRA-203" },
  { id: "10", fecha: "2026-06-24", programaEducativo: "Licenciatura en Biología",      asignatura: "Bioquímica",                codigo: "INS-001", producto: "Guantes de Nitrilo (caja)",  tipo: "Insumo",    consumo: "1",     unidad: "caja",    laboratorio: "N3",          practica: "PRA-203" },
  { id: "11", fecha: "2026-06-25", programaEducativo: "Ingeniería Industrial",         asignatura: "Control de Calidad Metalúrgico", codigo: "MAT-001", producto: "Vaso de Precipitado 250 ml", tipo: "Material", consumo: "8", unidad: "piezas",  laboratorio: "N3",          practica: "PRA-204" },
  { id: "12", fecha: "2026-06-25", programaEducativo: "Ingeniería Civil",              asignatura: "Química General",           codigo: "INS-002", producto: "Papel filtro Whatman #1",    tipo: "Insumo",    consumo: "1",     unidad: "paquete", laboratorio: "N4",          practica: "PRA-205" },
  { id: "13", fecha: "2026-06-26", programaEducativo: "Licenciatura en Biología",      asignatura: "Botánica",                  codigo: "BIO-001", producto: "Musgo Sphagnum",             tipo: "Materia Biológica", consumo: "10", unidad: "Fragmentos", laboratorio: "LUM",    practica: "PRA-206" },
];

export function Reports() {
  const [fechaInicio, setFechaInicio] = useState("2026-06-01");
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split("T")[0]);
  const [programa, setPrograma] = useState("Todos");
  const [laboratorio, setLaboratorio] = useState("Todos");
  const [tipoProducto, setTipoProducto] = useState("todos");

  const filtered = SAMPLE_DATA.filter((r) => {
    const matchProg = programa === "Todos" || r.programaEducativo === programa;
    const matchLab  = laboratorio === "Todos" || r.laboratorio === laboratorio;
    const matchTipo =
      tipoProducto === "todos" ||
      (tipoProducto === "reactivos"  && r.tipo === "Reactivo") ||
      (tipoProducto === "materiales" && r.tipo === "Material") ||
      (tipoProducto === "equipos"    && r.tipo === "Equipo") ||
      (tipoProducto === "insumos"    && r.tipo === "Insumo") ||
      (tipoProducto === "biologico"  && r.tipo === "Materia Biológica");
    const d = new Date(r.fecha);
    const matchDate = d >= new Date(fechaInicio) && d <= new Date(fechaFin + "T23:59:59");
    return matchProg && matchLab && matchTipo && matchDate;
  });

  const handleExportExcel = () => toast.success("Exportando a Excel...", { description: `${filtered.length} registros` });
  const handleExportPDF   = () => toast.success("Exportando a PDF...",   { description: `${filtered.length} registros` });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-[#C10230] mb-1">Reportes y Auditorías</h1>
        <p className="text-[#6F6F6E]">Genere reportes detallados del uso de productos del laboratorio</p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-[#C10230] flex items-center gap-2 text-base">
            <Filter className="w-4 h-4" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Fecha Inicio</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs">Fecha Fin</Label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs">Programa Educativo</Label>
              <Select value={programa} onValueChange={setPrograma}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROGRAMAS.map((p) => <SelectItem key={p} value={p} className="text-sm">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Laboratorio</Label>
              <Select value={laboratorio} onValueChange={setLaboratorio}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LABORATORIOS.map((l) => <SelectItem key={l} value={l}>{l === "Todos" ? "Todos" : l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Tipo de Producto</Label>
              <Select value={tipoProducto} onValueChange={setTipoProducto}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="reactivos">Reactivos</SelectItem>
                  <SelectItem value="materiales">Materiales</SelectItem>
                  <SelectItem value="equipos">Equipos</SelectItem>
                  <SelectItem value="insumos">Insumos</SelectItem>
                  <SelectItem value="biologico">Materia Biológica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div />
            <Button className="self-end bg-[#C10230] hover:bg-[#A21A19] gap-2 h-9" onClick={handleExportExcel}>
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </Button>
            <Button className="self-end bg-[#ED5E17] hover:bg-[#C10230] gap-2 h-9" onClick={handleExportPDF}>
              <FileDown className="w-4 h-4" />
              Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge className="bg-[#C10230] text-white px-3 py-1">
            {filtered.length} registros
          </Badge>
          <p className="text-sm text-[#6F6F6E]">
            {new Date(fechaInicio + "T12:00").toLocaleDateString("es-MX")} — {new Date(fechaFin + "T12:00").toLocaleDateString("es-MX")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[#C10230] text-base">Resultados del Reporte</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[#6F6F6E]">
              <p className="font-medium">Sin resultados</p>
              <p className="text-sm mt-1">Ajuste los filtros de búsqueda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm">Fecha</TableHead>
                    <TableHead className="text-sm">Programa Educativo</TableHead>
                    <TableHead className="text-sm">Asignatura</TableHead>
                    <TableHead className="text-sm">Código</TableHead>
                    <TableHead className="text-sm">Producto</TableHead>
                    <TableHead className="text-sm">Tipo</TableHead>
                    <TableHead className="text-sm">Consumo</TableHead>
                    <TableHead className="text-sm">Unidad</TableHead>
                    <TableHead className="text-sm">Laboratorio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const labColor = LAB_COLOR[r.laboratorio] ?? "#6F6F6E";
                    return (
                      <TableRow key={r.id} className="hover:bg-[#F5F6F8]">
                        <TableCell className="text-sm font-medium whitespace-nowrap">
                          {new Date(r.fecha + "T12:00").toLocaleDateString("es-MX")}
                        </TableCell>
                        <TableCell className="text-sm max-w-[140px]">
                          <p className="truncate" title={r.programaEducativo}>{r.programaEducativo}</p>
                        </TableCell>
                        <TableCell className="text-sm">{r.asignatura}</TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-[#C10230]">{r.codigo}</TableCell>
                        <TableCell className="text-sm font-medium">{r.producto}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs py-0 ${TIPO_BADGE_STYLE[r.tipo] ?? ""}`}>
                            {r.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-[#C10230]">{r.consumo}</TableCell>
                        <TableCell className="text-sm text-[#6F6F6E]">{r.unidad}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: labColor }}>
                            {r.laboratorio}
                          </span>
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

      {filtered.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[
            { label: "Prácticas",         value: new Set(filtered.map((r) => r.practica)).size,          color: "#C10230" },
            { label: "Productos únicos",  value: new Set(filtered.map((r) => r.codigo)).size,            color: "#ED5E17" },
            { label: "Laboratorios",      value: new Set(filtered.map((r) => r.laboratorio)).size,       color: "#2563EB" },
            { label: "Programas",         value: new Set(filtered.map((r) => r.programaEducativo)).size, color: "#7C3AED" },
          ].map(({ label, value, color }) => (
            <Card key={label} style={{ borderLeftColor: color }} className="border-l-4">
              <CardContent className="p-4">
                <p className="text-sm text-[#6F6F6E] mb-1">{label}</p>
                <p className="text-2xl font-bold" style={{ color }}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
