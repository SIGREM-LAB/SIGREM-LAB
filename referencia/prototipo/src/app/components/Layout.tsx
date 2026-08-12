import { Outlet, Link, useLocation, Navigate } from "react-router";
import { LayoutDashboard, PackageSearch, FlaskConical, FileBarChart, LogOut, User, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";

const LAB_COLOR: Record<string, string> = {
  N3:          "#C10230",
  N4:          "#ED5E17",
  LUM:         "#2563EB",
  Electrónica: "#7C3AED",
};

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  const labColor = LAB_COLOR[user.laboratorio] ?? "#6F6F6E";

  const menuItems = [
    { path: "/", label: "Menú Principal", icon: LayoutDashboard },
    { path: "/inventario", label: "Inventario", icon: PackageSearch },
    { path: "/practicas", label: "Prácticas", icon: FlaskConical },
    { path: "/reportes", label: "Reportes", icon: FileBarChart },
    ...(user.isAdmin ? [{ path: "/inventario-general", label: "Inventario General", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="flex h-screen bg-[#F5F6F8]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#C10230] text-white shadow-lg flex flex-col">
        {/* Logo y Header */}
        <div className="p-6 border-b border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
              <div className="w-10 h-10 bg-[#C10230] rounded-md flex items-center justify-center">
                <span className="font-bold text-white text-xs">UAEH</span>
              </div>
            </div>
            <div className="flex-1">
              <h1 className="font-bold leading-tight text-[20px]">Universidad Autónoma del Estado de Hidalgo</h1>
            </div>
          </div>
          <p className="text-white/80 mb-1 text-[16px] text-[#ffffffcc]">Unidad Central de Laboratorios</p>
          <h2 className="text-base font-bold">SIGREM-LAB</h2>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                  isActive
                    ? "bg-white/20 border-r-4 border-white"
                    : "hover:bg-white/10"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User info + Logout */}
        <div className="p-4 border-t border-white/20">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold truncate">{user.nombre}</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: labColor }} />
                <p className="text-xs text-white/70">{user.laboratorio}</p>
                {user.isAdmin && <span className="text-xs text-white/60 bg-white/10 px-1.5 py-0.5 rounded">Admin</span>}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full text-white/80 hover:text-white hover:bg-white/10 justify-start gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
