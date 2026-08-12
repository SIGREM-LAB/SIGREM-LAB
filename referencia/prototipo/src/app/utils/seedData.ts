import { useInventoryStore } from "../store/inventoryStore";
import { usePracticasStore } from "../store/practicasStore";

export const seedInitialData = () => {
  const inventoryStore = useInventoryStore.getState();
  const practicasStore = usePracticasStore.getState();

  // Solo agregar datos si no existen
  if (inventoryStore.items.length === 0) {
    // Reactivos líquidos
    inventoryStore.addItem({
      nombre: "Ácido Sulfúrico",
      marca: "Merck",
      descripcion: "Ácido sulfúrico concentrado 98%",
      tipo: "Reactivo líquido",
      existencia: 5000,
      existenciaInicial: 5000,
      unidad: "ml",
      cantidadMinima: 1000,
      fechaAdquisicion: "2024-01-15",
      fechaCaducidad: "2026-01-15",
    });

    inventoryStore.addItem({
      nombre: "Hidróxido de Sodio",
      marca: "Sigma-Aldrich",
      descripcion: "Solución de NaOH al 50%",
      tipo: "Reactivo líquido",
      existencia: 3000,
      existenciaInicial: 3000,
      unidad: "ml",
      cantidadMinima: 500,
      fechaAdquisicion: "2024-02-10",
      fechaCaducidad: "2026-02-10",
    });

    // Reactivos sólidos
    inventoryStore.addItem({
      nombre: "Cloruro de Sodio",
      marca: "Meyer",
      descripcion: "NaCl grado reactivo",
      tipo: "Reactivo sólido",
      existencia: 2500,
      existenciaInicial: 2500,
      unidad: "g",
      cantidadMinima: 500,
      fechaAdquisicion: "2024-01-20",
      fechaCaducidad: "2027-01-20",
    });

    inventoryStore.addItem({
      nombre: "Carbonato de Calcio",
      marca: "J.T.Baker",
      descripcion: "CaCO3 puro",
      tipo: "Reactivo sólido",
      existencia: 1500,
      existenciaInicial: 1500,
      unidad: "g",
      cantidadMinima: 300,
      fechaAdquisicion: "2024-03-05",
      fechaCaducidad: "2027-03-05",
    });

    // Materiales
    inventoryStore.addItem({
      nombre: "Vasos de precipitado 250ml",
      marca: "Pyrex",
      descripcion: "Vasos de vidrio borosilicato",
      tipo: "Material",
      existencia: 50,
      existenciaInicial: 50,
      unidad: "piezas",
      cantidadMinima: 10,
      fechaAdquisicion: "2023-12-01",
    });

    inventoryStore.addItem({
      nombre: "Pipetas graduadas 10ml",
      marca: "Brand",
      descripcion: "Pipetas volumétricas clase A",
      tipo: "Material",
      existencia: 30,
      existenciaInicial: 30,
      unidad: "piezas",
      cantidadMinima: 5,
      fechaAdquisicion: "2024-01-10",
    });

    inventoryStore.addItem({
      nombre: "Matraces Erlenmeyer 500ml",
      marca: "Pyrex",
      descripcion: "Matraces de vidrio",
      tipo: "Material",
      existencia: 25,
      existenciaInicial: 25,
      unidad: "piezas",
      cantidadMinima: 5,
      fechaAdquisicion: "2023-11-15",
    });

    // Equipos
    inventoryStore.addItem({
      nombre: "Balanza Analítica",
      marca: "Sartorius",
      descripcion: "Balanza de precisión 0.0001g",
      tipo: "Equipo",
      existencia: 3,
      existenciaInicial: 3,
      unidad: "piezas",
      cantidadMinima: 1,
      fechaAdquisicion: "2023-08-20",
    });

    inventoryStore.addItem({
      nombre: "Agitador Magnético",
      marca: "IKA",
      descripcion: "Agitador con calentamiento",
      tipo: "Equipo",
      existencia: 5,
      existenciaInicial: 5,
      unidad: "piezas",
      cantidadMinima: 1,
      fechaAdquisicion: "2023-09-10",
    });

    inventoryStore.addItem({
      nombre: "pH-metro Digital",
      marca: "Hanna",
      descripcion: "Medidor de pH portátil",
      tipo: "Equipo",
      existencia: 4,
      existenciaInicial: 4,
      unidad: "piezas",
      cantidadMinima: 1,
      fechaAdquisicion: "2024-02-15",
    });
  }
};
