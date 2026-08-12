import { Outlet, NavLink } from "react-router";
import { Home, FlaskConical, FileText, ClipboardList } from "lucide-react";

export default function Root() {
  return (
    <div className="flex h-screen bg-[#F5F6F8]">
      {/* Menú lateral */}
      <aside className="w-64 bg-[#C10230] text-white flex flex-col">
        {/* Logo y encabezado */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
              <FlaskConical className="w-8 h-8 text-[#C10230]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">UAEH</h2>
              <p className="text-xs opacity-90">UCL</p>
            </div>
          </div>
          <h1 className="text-lg font-bold mt-4">SIGREM-LAB</h1>
          <p className="text-xs opacity-80 mt-1">Sistema Integral de Gestión</p>
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-white text-[#C10230]"
                      : "hover:bg-white/10"
                  }`
                }
              >
                <Home className="w-5 h-5" />
                <span>Menú Principal</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/inventario"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-white text-[#C10230]"
                      : "hover:bg-white/10"
                  }`
                }
              >
                <FlaskConical className="w-5 h-5" />
                <span>Inventario</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/practicas"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-white text-[#C10230]"
                      : "hover:bg-white/10"
                  }`
                }
              >
                <ClipboardList className="w-5 h-5" />
                <span>Prácticas</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/reportes"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-white text-[#C10230]"
                      : "hover:bg-white/10"
                  }`
                }
              >
                <FileText className="w-5 h-5" />
                <span>Reportes</span>
              </NavLink>
            </li>
          </ul>
        </nav>

        {/* Información institucional */}
        <div className="p-4 border-t border-white/10">
          <p className="text-xs opacity-70">Universidad Autónoma del</p>
          <p className="text-xs opacity-70">Estado de Hidalgo</p>
          <p className="text-xs opacity-70 mt-2">Unidad Central de Laboratorios</p>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
