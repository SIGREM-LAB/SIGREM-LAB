import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { Inventory } from "./components/Inventory";
import { Practices } from "./components/Practices";
import { Reports } from "./components/Reports";
import { InventarioGeneral } from "./components/InventarioGeneral";

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "inventario", Component: Inventory },
      { path: "inventario-general", Component: InventarioGeneral },
      { path: "practicas", Component: Practices },
      { path: "reportes", Component: Reports },
    ],
  },
]);
