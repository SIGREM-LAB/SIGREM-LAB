import { Link, useNavigate } from "react-router";
import { PackageSearch, FlaskConical, FileBarChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useAuth } from "../context/AuthContext";

const LAB_COLOR: Record<string, string> = {
  N3:          "#C10230",
  N4:          "#ED5E17",
  LUM:         "#2563EB",
  Electrónica: "#7C3AED",
};

interface PracticaReciente {
  numero: string;
  programaEducativo: string;
  asignatura: string;
  laboratorio: string;
  fecha: string;
  hora: string;
  estado: "en_proceso" | "finalizada";
}

const PRACTICAS_RECIENTES: PracticaReciente[] = [
  { numero: "PRA-205", programaEducativo: "Licenciatura en Química",       asignatura: "Química Analítica",             laboratorio: "N4",          fecha: "2026-07-05", hora: "08:00", estado: "finalizada" },
  { numero: "PRA-204", programaEducativo: "Química de Alimentos",          asignatura: "Control de Calidad Alimentario", laboratorio: "N3",          fecha: "2026-07-05", hora: "10:30", estado: "en_proceso" },
  { numero: "PRA-203", programaEducativo: "Licenciatura en Biología",      asignatura: "Bioquímica",                    laboratorio: "N3",          fecha: "2026-07-04", hora: "09:00", estado: "finalizada" },
  { numero: "PRA-202", programaEducativo: "Ingeniería Minero Metalúrgica", asignatura: "Mineralogía",                   laboratorio: "N4",          fecha: "2026-07-04", hora: "11:00", estado: "finalizada" },
  { numero: "PRA-201", programaEducativo: "Química de Alimentos",          asignatura: "Microbiología de Alimentos",    laboratorio: "LUM",         fecha: "2026-07-03", hora: "08:30", estado: "en_proceso" },
  { numero: "PRA-200", programaEducativo: "Licenciatura en Química",       asignatura: "Química Orgánica I",            laboratorio: "Electrónica", fecha: "2026-07-03", hora: "07:00", estado: "finalizada" },
  { numero: "PRA-199", programaEducativo: "Licenciatura en Biología",      asignatura: "Microbiología",                 laboratorio: "N3",          fecha: "2026-07-02", hora: "10:00", estado: "en_proceso" },
  { numero: "PRA-198", programaEducativo: "Licenciatura en Química",       asignatura: "Química General I",             laboratorio: "N4",          fecha: "2026-07-01", hora: "08:00", estado: "finalizada" },
];

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  function handlePracticaClick(p: PracticaReciente) {
    navigate("/practicas", { state: { practica: p } });
  }

  return (
    <div className="p-8 overflow-auto h-full">
      {/* Header */}
      <div className="mb-7">
        <h1 className="font-bold text-[#C10230] mb-1 text-4xl">Menú Principal</h1>
        <p className="text-[#6F6F6E]">
          Bienvenido, <span className="font-semibold text-gray-700">{user?.nombre}</span> — {user?.laboratorio}
        </p>
      </div>

      {/* Quick Access Cards — 3 cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <Link to="/inventario">
          <Card className="hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-[#C10230] group">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#C10230] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <PackageSearch className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#C10230]">Inventario</h3>
                  <p className="text-sm text-[#000000]">Gestionar productos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/practicas">
          <Card className="hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-[#ED5E17] group">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#ED5E17] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FlaskConical className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#ED5E17]">Nueva Práctica</h3>
                  <p className="text-sm text-[#000000]">Registrar práctica</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/reportes">
          <Card className="hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-[#2563EB] group">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#2563EB] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileBarChart className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#2563EB]">Reportes</h3>
                  <p className="text-sm text-[#000000]">Generar informes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Prácticas Recientes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[#C10230] text-base flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            Prácticas Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-sm">Número de práctica</TableHead>
                <TableHead className="text-sm">Programa educativo</TableHead>
                <TableHead className="text-sm">Asignatura</TableHead>
                <TableHead className="text-sm">Laboratorio</TableHead>
                <TableHead className="text-sm">Fecha</TableHead>
                <TableHead className="text-sm">Hora</TableHead>
                <TableHead className="text-sm">Progreso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PRACTICAS_RECIENTES.map((p) => {
                const labColor = LAB_COLOR[p.laboratorio] ?? "#6F6F6E";
                return (
                  <TableRow
                    key={p.numero}
                    className="hover:bg-[#F5F6F8] cursor-pointer transition-colors"
                    title={p.estado === "finalizada" ? "Ver práctica (solo lectura)" : "Continuar captura"}
                    onClick={() => handlePracticaClick(p)}
                  >
                    <TableCell className="font-mono font-semibold text-sm text-[#C10230]">{p.numero}</TableCell>
                    <TableCell className="text-sm max-w-[160px]">
                      <p className="truncate" title={p.programaEducativo}>{p.programaEducativo}</p>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{p.asignatura}</TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: labColor }}
                      >
                        {p.laboratorio}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[#6F6F6E]">
                      {new Date(p.fecha + "T12:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-sm text-[#6F6F6E]">{p.hora}</TableCell>
                    <TableCell>
                      {p.estado === "finalizada" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Finalizada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                          En proceso
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
