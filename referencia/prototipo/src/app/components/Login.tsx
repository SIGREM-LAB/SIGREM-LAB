import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { FlaskConical, Lock, User, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const ok = login(username, password);
    setLoading(false);
    if (ok) {
      navigate("/", { replace: true });
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#C10230] opacity-5 rounded-full" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#ED5E17] opacity-5 rounded-full" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header band */}
          <div className="bg-[#C10230] px-8 py-8 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <FlaskConical className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-white/80 tracking-widest uppercase font-bold text-[15px]">UAEH</p>
                <h1 className="text-lg font-bold leading-tight"><span className="">SIGREM-LAB</span></h1>
              </div>
            </div>
            <p className="text-white/80 text-sm">Unidad Central de Laboratorios</p>
            <p className="text-white/60 text-xs mt-1">Universidad Autónoma del Estado de Hidalgo</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-xl font-bold text-[#C10230] mb-1">Iniciar sesión</h2>
            <p className="text-sm text-[#6F6F6E] mb-6">
              Ingrese sus credenciales para acceder al sistema
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Usuario
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6F6F6E]" />
                  <Input
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(false); }}
                    placeholder="Nombre de usuario"
                    className="pl-10 h-11 border-gray-200 focus:border-[#C10230] focus:ring-[#C10230]"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6F6F6E]" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(false); }}
                    placeholder="Contraseña"
                    className="pl-10 h-11 border-gray-200 focus:border-[#C10230]"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-[#A21A19] bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm">Usuario o contraseña incorrectos</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full h-11 bg-[#C10230] hover:bg-[#A21A19] text-white font-semibold text-base transition-colors"
              >
                {loading ? "Verificando..." : "Iniciar sesión"}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-center text-[#6F6F6E]">
                El laboratorio asignado se detecta automáticamente según el usuario
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-[#6F6F6E] mt-4">
          © 2026 UAEH · Sistema Integral de Gestión de Reactivos, Materiales y Equipos
        </p>
      </div>
    </div>
  );
}
