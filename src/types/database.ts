export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      almacen: {
        Row: {
          activo: boolean
          clave: string
          creado_en: string
          id: number
          nombre: string
          personas_expuestas: number | null
          uso_principal: string | null
          zona_riesgo: string | null
        }
        Insert: {
          activo?: boolean
          clave: string
          creado_en?: string
          id?: never
          nombre: string
          personas_expuestas?: number | null
          uso_principal?: string | null
          zona_riesgo?: string | null
        }
        Update: {
          activo?: boolean
          clave?: string
          creado_en?: string
          id?: never
          nombre?: string
          personas_expuestas?: number | null
          uso_principal?: string | null
          zona_riesgo?: string | null
        }
        Relationships: []
      }
      articulo: {
        Row: {
          clasificacion: Database["public"]["Enums"]["clasificacion_articulo"]
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          familia: string | null
          id: number
          nombre_canonico: string
          unidad_base: string
          verificado: boolean
        }
        Insert: {
          clasificacion: Database["public"]["Enums"]["clasificacion_articulo"]
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          familia?: string | null
          id?: never
          nombre_canonico: string
          unidad_base: string
          verificado?: boolean
        }
        Update: {
          clasificacion?: Database["public"]["Enums"]["clasificacion_articulo"]
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          familia?: string | null
          id?: never
          nombre_canonico?: string
          unidad_base?: string
          verificado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "articulo_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      articulo_alias: {
        Row: {
          articulo_id: number
          creado_en: string
          id: number
          origen: Database["public"]["Enums"]["origen_alias"]
          texto: string
        }
        Insert: {
          articulo_id: number
          creado_en?: string
          id?: never
          origen?: Database["public"]["Enums"]["origen_alias"]
          texto: string
        }
        Update: {
          articulo_id?: number
          creado_en?: string
          id?: never
          origen?: Database["public"]["Enums"]["origen_alias"]
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "articulo_alias_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: false
            referencedRelation: "articulo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articulo_alias_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: false
            referencedRelation: "existencia_listado"
            referencedColumns: ["articulo_id"]
          },
        ]
      }
      articulo_biologico: {
        Row: {
          articulo_id: number
          origen_especie: string | null
        }
        Insert: {
          articulo_id: number
          origen_especie?: string | null
        }
        Update: {
          articulo_id?: number
          origen_especie?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articulo_biologico_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: true
            referencedRelation: "articulo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articulo_biologico_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: true
            referencedRelation: "existencia_listado"
            referencedColumns: ["articulo_id"]
          },
        ]
      }
      articulo_reactivo: {
        Row: {
          articulo_id: number
          caracteristica_quimica: string | null
          caracteristica_toxica: string | null
          cas: string | null
          color_almacenaje:
            | Database["public"]["Enums"]["color_almacenaje"]
            | null
          estado_fisico: Database["public"]["Enums"]["estado_fisico"] | null
          implica_actividad_peligro: boolean | null
          peligro_especial: string | null
          riesgo_inflamabilidad: number | null
          riesgo_reactividad: number | null
          riesgo_salud: number | null
          tiene_hoja_seguridad: boolean | null
        }
        Insert: {
          articulo_id: number
          caracteristica_quimica?: string | null
          caracteristica_toxica?: string | null
          cas?: string | null
          color_almacenaje?:
            | Database["public"]["Enums"]["color_almacenaje"]
            | null
          estado_fisico?: Database["public"]["Enums"]["estado_fisico"] | null
          implica_actividad_peligro?: boolean | null
          peligro_especial?: string | null
          riesgo_inflamabilidad?: number | null
          riesgo_reactividad?: number | null
          riesgo_salud?: number | null
          tiene_hoja_seguridad?: boolean | null
        }
        Update: {
          articulo_id?: number
          caracteristica_quimica?: string | null
          caracteristica_toxica?: string | null
          cas?: string | null
          color_almacenaje?:
            | Database["public"]["Enums"]["color_almacenaje"]
            | null
          estado_fisico?: Database["public"]["Enums"]["estado_fisico"] | null
          implica_actividad_peligro?: boolean | null
          peligro_especial?: string | null
          riesgo_inflamabilidad?: number | null
          riesgo_reactividad?: number | null
          riesgo_salud?: number | null
          tiene_hoja_seguridad?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "articulo_reactivo_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: true
            referencedRelation: "articulo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articulo_reactivo_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: true
            referencedRelation: "existencia_listado"
            referencedColumns: ["articulo_id"]
          },
        ]
      }
      asignatura: {
        Row: {
          activo: boolean
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      campo_capturable: {
        Row: {
          ayuda: string | null
          campo: string
          destino: string
          etiqueta_default: string
          opciones: string[] | null
          tipo_dato: string
        }
        Insert: {
          ayuda?: string | null
          campo: string
          destino: string
          etiqueta_default: string
          opciones?: string[] | null
          tipo_dato: string
        }
        Update: {
          ayuda?: string | null
          campo?: string
          destino?: string
          etiqueta_default?: string
          opciones?: string[] | null
          tipo_dato?: string
        }
        Relationships: []
      }
      carga: {
        Row: {
          actualizado_el: string | null
          almacen_id: number
          archivo: string
          cargado_en: string
          cargado_por: string | null
          filas: number | null
          hoja: string
          id: number
          periodo: string | null
          responsable: string | null
        }
        Insert: {
          actualizado_el?: string | null
          almacen_id: number
          archivo: string
          cargado_en?: string
          cargado_por?: string | null
          filas?: number | null
          hoja: string
          id?: never
          periodo?: string | null
          responsable?: string | null
        }
        Update: {
          actualizado_el?: string | null
          almacen_id?: number
          archivo?: string
          cargado_en?: string
          cargado_por?: string | null
          filas?: number | null
          hoja?: string
          id?: never
          periodo?: string | null
          responsable?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carga_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_cargado_por_fkey"
            columns: ["cargado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      carga_pendiente: {
        Row: {
          almacen_id: number
          archivo: string
          carga_id: number | null
          creado_en: string
          estado: Database["public"]["Enums"]["estado_pendiente"]
          existencia_id: number | null
          existencia_resuelta_id: number | null
          fila: number
          hoja: string
          id: number
          motivo: Database["public"]["Enums"]["motivo_pendiente"]
          nota: string | null
          problemas: Json
          renglon: Json
          revisado_en: string | null
          revisado_por: string | null
        }
        Insert: {
          almacen_id: number
          archivo: string
          carga_id?: number | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_pendiente"]
          existencia_id?: number | null
          existencia_resuelta_id?: number | null
          fila: number
          hoja: string
          id?: never
          motivo: Database["public"]["Enums"]["motivo_pendiente"]
          nota?: string | null
          problemas: Json
          renglon: Json
          revisado_en?: string | null
          revisado_por?: string | null
        }
        Update: {
          almacen_id?: number
          archivo?: string
          carga_id?: number | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_pendiente"]
          existencia_id?: number | null
          existencia_resuelta_id?: number | null
          fila?: number
          hoja?: string
          id?: never
          motivo?: Database["public"]["Enums"]["motivo_pendiente"]
          nota?: string | null
          problemas?: Json
          renglon?: Json
          revisado_en?: string | null
          revisado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carga_pendiente_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_pendiente_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_pendiente_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "carga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_pendiente_existencia_id_fkey"
            columns: ["existencia_id"]
            isOneToOne: false
            referencedRelation: "existencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_pendiente_existencia_id_fkey"
            columns: ["existencia_id"]
            isOneToOne: false
            referencedRelation: "existencia_listado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_pendiente_existencia_resuelta_id_fkey"
            columns: ["existencia_resuelta_id"]
            isOneToOne: false
            referencedRelation: "existencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_pendiente_existencia_resuelta_id_fkey"
            columns: ["existencia_resuelta_id"]
            isOneToOne: false
            referencedRelation: "existencia_listado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_pendiente_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      existencia: {
        Row: {
          almacen_id: number
          articulo_id: number
          cantidad: number
          cantidad_minima: number | null
          carga_id: number | null
          codigo: string | null
          creado_en: string
          estado: Database["public"]["Enums"]["estado_existencia"]
          fecha_adquisicion: string | null
          fecha_caducidad: string | null
          fecha_chequeo: string | null
          fecha_preparacion: string | null
          fecha_recoleccion: string | null
          funcionamiento:
            | Database["public"]["Enums"]["funcionamiento_equipo"]
            | null
          id: number
          laboratorio_id: number | null
          mantenimiento: string | null
          marca: string | null
          metodo_conservacion: string | null
          modelo: string | null
          numero_inventario_uaeh: string | null
          numero_serie: string | null
          observaciones: string | null
          peso_frasco_vacio: number | null
          peso_total: number | null
          presentacion: string | null
          responsable_muestra: string | null
          temperatura: string | null
          ubicacion_id: number | null
        }
        Insert: {
          almacen_id: number
          articulo_id: number
          cantidad?: number
          cantidad_minima?: number | null
          carga_id?: number | null
          codigo?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_existencia"]
          fecha_adquisicion?: string | null
          fecha_caducidad?: string | null
          fecha_chequeo?: string | null
          fecha_preparacion?: string | null
          fecha_recoleccion?: string | null
          funcionamiento?:
            | Database["public"]["Enums"]["funcionamiento_equipo"]
            | null
          id?: never
          laboratorio_id?: number | null
          mantenimiento?: string | null
          marca?: string | null
          metodo_conservacion?: string | null
          modelo?: string | null
          numero_inventario_uaeh?: string | null
          numero_serie?: string | null
          observaciones?: string | null
          peso_frasco_vacio?: number | null
          peso_total?: number | null
          presentacion?: string | null
          responsable_muestra?: string | null
          temperatura?: string | null
          ubicacion_id?: number | null
        }
        Update: {
          almacen_id?: number
          articulo_id?: number
          cantidad?: number
          cantidad_minima?: number | null
          carga_id?: number | null
          codigo?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_existencia"]
          fecha_adquisicion?: string | null
          fecha_caducidad?: string | null
          fecha_chequeo?: string | null
          fecha_preparacion?: string | null
          fecha_recoleccion?: string | null
          funcionamiento?:
            | Database["public"]["Enums"]["funcionamiento_equipo"]
            | null
          id?: never
          laboratorio_id?: number | null
          mantenimiento?: string | null
          marca?: string | null
          metodo_conservacion?: string | null
          modelo?: string | null
          numero_inventario_uaeh?: string | null
          numero_serie?: string | null
          observaciones?: string | null
          peso_frasco_vacio?: number | null
          peso_total?: number | null
          presentacion?: string | null
          responsable_muestra?: string | null
          temperatura?: string | null
          ubicacion_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "existencia_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "existencia_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "existencia_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: false
            referencedRelation: "articulo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "existencia_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: false
            referencedRelation: "existencia_listado"
            referencedColumns: ["articulo_id"]
          },
          {
            foreignKeyName: "existencia_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "carga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "existencia_laboratorio_id_almacen_id_fkey"
            columns: ["laboratorio_id", "almacen_id"]
            isOneToOne: false
            referencedRelation: "laboratorio"
            referencedColumns: ["id", "almacen_id"]
          },
          {
            foreignKeyName: "existencia_ubicacion_id_almacen_id_fkey"
            columns: ["ubicacion_id", "almacen_id"]
            isOneToOne: false
            referencedRelation: "ubicacion"
            referencedColumns: ["id", "almacen_id"]
          },
        ]
      }
      laboratorio: {
        Row: {
          activo: boolean
          almacen_id: number
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          almacen_id: number
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          almacen_id?: number
          id?: never
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "laboratorio_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laboratorio_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
        ]
      }
      motivo_observacion: {
        Row: {
          activo: boolean
          clave: string
          etiqueta: string
          orden: number
        }
        Insert: {
          activo?: boolean
          clave: string
          etiqueta: string
          orden: number
        }
        Update: {
          activo?: boolean
          clave?: string
          etiqueta?: string
          orden?: number
        }
        Relationships: []
      }
      movimiento: {
        Row: {
          almacen_id: number
          cantidad: number
          cantidad_antes: number
          cantidad_despues: number
          existencia_id: number
          id: number
          motivo: string | null
          ocurrido_en: string
          practica_id: number | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string
        }
        Insert: {
          almacen_id: number
          cantidad: number
          cantidad_antes: number
          cantidad_despues: number
          existencia_id: number
          id?: never
          motivo?: string | null
          ocurrido_en?: string
          practica_id?: number | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string
        }
        Update: {
          almacen_id?: number
          cantidad?: number
          cantidad_antes?: number
          cantidad_despues?: number
          existencia_id?: number
          id?: never
          motivo?: string | null
          ocurrido_en?: string
          practica_id?: number | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_existencia_id_fkey"
            columns: ["existencia_id"]
            isOneToOne: false
            referencedRelation: "existencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_existencia_id_fkey"
            columns: ["existencia_id"]
            isOneToOne: false
            referencedRelation: "existencia_listado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: false
            referencedRelation: "practica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil: {
        Row: {
          almacen_id: number | null
          creado_en: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Insert: {
          almacen_id?: number | null
          creado_en?: string
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
        }
        Update: {
          almacen_id?: number | null
          creado_en?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
        }
        Relationships: [
          {
            foreignKeyName: "perfil_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_campo: {
        Row: {
          campo: string
          etiqueta: string | null
          obligatorio: boolean
          orden: number
          perfil_id: number
        }
        Insert: {
          campo: string
          etiqueta?: string | null
          obligatorio?: boolean
          orden: number
          perfil_id: number
        }
        Update: {
          campo?: string
          etiqueta?: string | null
          obligatorio?: boolean
          orden?: number
          perfil_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "perfil_campo_campo_fkey"
            columns: ["campo"]
            isOneToOne: false
            referencedRelation: "campo_capturable"
            referencedColumns: ["campo"]
          },
          {
            foreignKeyName: "perfil_campo_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil_captura"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_captura: {
        Row: {
          almacen_id: number | null
          clasificacion: Database["public"]["Enums"]["clasificacion_articulo"]
          id: number
          nombre: string
          notas: string | null
        }
        Insert: {
          almacen_id?: number | null
          clasificacion: Database["public"]["Enums"]["clasificacion_articulo"]
          id?: never
          nombre: string
          notas?: string | null
        }
        Update: {
          almacen_id?: number | null
          clasificacion?: Database["public"]["Enums"]["clasificacion_articulo"]
          id?: never
          nombre?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfil_captura_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_captura_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
        ]
      }
      practica: {
        Row: {
          almacen_id: number
          asignatura_id: number | null
          creado_en: string
          fecha: string
          folio: string | null
          id: number
          laboratorio_id: number
          observaciones: string | null
          practica_catalogo_id: number | null
          programa_educativo_id: number
          registrado_por: string
        }
        Insert: {
          almacen_id: number
          asignatura_id?: number | null
          creado_en?: string
          fecha?: string
          folio?: string | null
          id?: never
          laboratorio_id: number
          observaciones?: string | null
          practica_catalogo_id?: number | null
          programa_educativo_id: number
          registrado_por: string
        }
        Update: {
          almacen_id?: number
          asignatura_id?: number | null
          creado_en?: string
          fecha?: string
          folio?: string | null
          id?: never
          laboratorio_id?: number
          observaciones?: string | null
          practica_catalogo_id?: number | null
          programa_educativo_id?: number
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "practica_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignatura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_catalogo_coincide"
            columns: ["practica_catalogo_id", "asignatura_id"]
            isOneToOne: false
            referencedRelation: "practica_catalogo"
            referencedColumns: ["id", "asignatura_id"]
          },
          {
            foreignKeyName: "practica_laboratorio_id_fkey"
            columns: ["laboratorio_id"]
            isOneToOne: false
            referencedRelation: "laboratorio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_pareja_valida"
            columns: ["programa_educativo_id", "asignatura_id"]
            isOneToOne: false
            referencedRelation: "programa_asignatura"
            referencedColumns: ["programa_educativo_id", "asignatura_id"]
          },
          {
            foreignKeyName: "practica_practica_catalogo_id_fkey"
            columns: ["practica_catalogo_id"]
            isOneToOne: false
            referencedRelation: "practica_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_programa_educativo_id_fkey"
            columns: ["programa_educativo_id"]
            isOneToOne: false
            referencedRelation: "programa_educativo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      practica_catalogo: {
        Row: {
          activo: boolean
          asignatura_id: number
          creado_en: string
          id: number
          nombre: string
          numero: number
        }
        Insert: {
          activo?: boolean
          asignatura_id: number
          creado_en?: string
          id?: never
          nombre: string
          numero: number
        }
        Update: {
          activo?: boolean
          asignatura_id?: number
          creado_en?: string
          id?: never
          nombre?: string
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "practica_catalogo_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignatura"
            referencedColumns: ["id"]
          },
        ]
      }
      practica_elemento: {
        Row: {
          almacen_id: number
          cantidad_danada: number | null
          cantidad_devuelta: number | null
          cantidad_entregada: number | null
          consumo: number | null
          creado_en: string
          estado_devolucion:
            | Database["public"]["Enums"]["funcionamiento_equipo"]
            | null
          estado_salida:
            | Database["public"]["Enums"]["funcionamiento_equipo"]
            | null
          existencia_id: number
          id: number
          metodo_control: Database["public"]["Enums"]["metodo_control"]
          observaciones: string | null
          perdidas: number | null
          peso_final: number | null
          peso_inicial: number | null
          practica_id: number
        }
        Insert: {
          almacen_id: number
          cantidad_danada?: number | null
          cantidad_devuelta?: number | null
          cantidad_entregada?: number | null
          consumo?: number | null
          creado_en?: string
          estado_devolucion?:
            | Database["public"]["Enums"]["funcionamiento_equipo"]
            | null
          estado_salida?:
            | Database["public"]["Enums"]["funcionamiento_equipo"]
            | null
          existencia_id: number
          id?: never
          metodo_control: Database["public"]["Enums"]["metodo_control"]
          observaciones?: string | null
          perdidas?: number | null
          peso_final?: number | null
          peso_inicial?: number | null
          practica_id: number
        }
        Update: {
          almacen_id?: number
          cantidad_danada?: number | null
          cantidad_devuelta?: number | null
          cantidad_entregada?: number | null
          consumo?: number | null
          creado_en?: string
          estado_devolucion?:
            | Database["public"]["Enums"]["funcionamiento_equipo"]
            | null
          estado_salida?:
            | Database["public"]["Enums"]["funcionamiento_equipo"]
            | null
          existencia_id?: number
          id?: never
          metodo_control?: Database["public"]["Enums"]["metodo_control"]
          observaciones?: string | null
          perdidas?: number | null
          peso_final?: number | null
          peso_inicial?: number | null
          practica_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "practica_elemento_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_elemento_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_elemento_existencia_id_fkey"
            columns: ["existencia_id"]
            isOneToOne: false
            referencedRelation: "existencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_elemento_existencia_id_fkey"
            columns: ["existencia_id"]
            isOneToOne: false
            referencedRelation: "existencia_listado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_elemento_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: false
            referencedRelation: "practica"
            referencedColumns: ["id"]
          },
        ]
      }
      practica_observacion: {
        Row: {
          motivo: string
          practica_id: number
        }
        Insert: {
          motivo: string
          practica_id: number
        }
        Update: {
          motivo?: string
          practica_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "practica_observacion_motivo_fkey"
            columns: ["motivo"]
            isOneToOne: false
            referencedRelation: "motivo_observacion"
            referencedColumns: ["clave"]
          },
          {
            foreignKeyName: "practica_observacion_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: false
            referencedRelation: "practica"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_asignatura: {
        Row: {
          asignatura_id: number
          programa_educativo_id: number
          semestre: number | null
        }
        Insert: {
          asignatura_id: number
          programa_educativo_id: number
          semestre?: number | null
        }
        Update: {
          asignatura_id?: number
          programa_educativo_id?: number
          semestre?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "programa_asignatura_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignatura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_asignatura_programa_educativo_id_fkey"
            columns: ["programa_educativo_id"]
            isOneToOne: false
            referencedRelation: "programa_educativo"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_educativo: {
        Row: {
          activo: boolean
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      ubicacion: {
        Row: {
          almacen_id: number
          componentes: Json
          etiqueta: string
          id: number
        }
        Insert: {
          almacen_id: number
          componentes?: Json
          etiqueta: string
          id?: never
        }
        Update: {
          almacen_id?: number
          componentes?: Json
          etiqueta?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "ubicacion_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubicacion_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      almacen_resumen: {
        Row: {
          activo: boolean | null
          agotado: number | null
          baja: number | null
          clave: string | null
          contaminado: number | null
          disponible: number | null
          id: number | null
          mantenimiento: number | null
          nombre: string | null
          stock_bajo: number | null
          total: number | null
        }
        Relationships: []
      }
      existencia_listado: {
        Row: {
          almacen_clave: string | null
          almacen_id: number | null
          articulo_id: number | null
          cantidad: number | null
          clasificacion:
            | Database["public"]["Enums"]["clasificacion_articulo"]
            | null
          codigo: string | null
          creado_en: string | null
          descripcion: string | null
          estado: Database["public"]["Enums"]["estado_existencia"] | null
          fecha_caducidad: string | null
          id: number | null
          marca: string | null
          marca_norm: string | null
          nombre_canonico: string | null
          nombre_norm: string | null
          ubicacion: string | null
          ubicacion_id: number | null
          unidad_base: string | null
        }
        Relationships: [
          {
            foreignKeyName: "existencia_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "existencia_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacen_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "existencia_ubicacion_id_almacen_id_fkey"
            columns: ["ubicacion_id", "almacen_id"]
            isOneToOne: false
            referencedRelation: "ubicacion"
            referencedColumns: ["id", "almacen_id"]
          },
        ]
      }
    }
    Functions: {
      buscar_articulo: {
        Args: { maximo?: number; termino: string; umbral?: number }
        Returns: {
          articulo_id: number
          clasificacion: Database["public"]["Enums"]["clasificacion_articulo"]
          coincidio_por: string
          nombre_canonico: string
          similitud: number
          unidad_base: string
          verificado: boolean
        }[]
      }
      formulario: {
        Args: {
          p_almacen: number
          p_clasificacion: Database["public"]["Enums"]["clasificacion_articulo"]
        }
        Returns: {
          ayuda: string
          campo: string
          destino: string
          etiqueta: string
          obligatorio: boolean
          opciones: string[]
          orden: number
          tipo_dato: string
        }[]
      }
      fusionar_articulo: {
        Args: { destino: number; origen: number }
        Returns: undefined
      }
      norm_texto: { Args: { t: string }; Returns: string }
      resolver_pendiente: {
        Args: {
          p_nota?: string
          p_pendiente: number
          p_renglon?: Json
          p_veredicto?: Database["public"]["Enums"]["veredicto_pendiente"]
        }
        Returns: number
      }
      vincular_asignatura: {
        Args: { p_nombre: string; p_programa: number; p_semestre?: number }
        Returns: number
      }
    }
    Enums: {
      clasificacion_articulo:
        | "reactivo"
        | "material"
        | "insumo"
        | "equipo"
        | "componente"
        | "materia_biologica"
      color_almacenaje:
        | "verde"
        | "rojo"
        | "azul"
        | "blanco"
        | "amarillo"
        | "naranja"
      estado_existencia:
        | "disponible"
        | "stock_bajo"
        | "agotado"
        | "contaminado"
        | "mantenimiento"
        | "baja"
      estado_fisico: "solido" | "liquido" | "gas"
      estado_pendiente: "pendiente" | "resuelto" | "descartado"
      funcionamiento_equipo: "correcto" | "presenta_fallas"
      metodo_control: "peso" | "cantidad" | "prestamo"
      motivo_pendiente: "regla" | "posible_duplicado"
      origen_alias: "migracion" | "busqueda" | "fusion"
      rol_usuario: "admin" | "responsable" | "consulta"
      tipo_movimiento:
        | "carga_inicial"
        | "entrada"
        | "consumo"
        | "merma"
        | "ajuste_conteo"
        | "prestamo"
        | "devolucion"
        | "baja"
      veredicto_pendiente: "nueva" | "duplicado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      clasificacion_articulo: [
        "reactivo",
        "material",
        "insumo",
        "equipo",
        "componente",
        "materia_biologica",
      ],
      color_almacenaje: [
        "verde",
        "rojo",
        "azul",
        "blanco",
        "amarillo",
        "naranja",
      ],
      estado_existencia: [
        "disponible",
        "stock_bajo",
        "agotado",
        "contaminado",
        "mantenimiento",
        "baja",
      ],
      estado_fisico: ["solido", "liquido", "gas"],
      estado_pendiente: ["pendiente", "resuelto", "descartado"],
      funcionamiento_equipo: ["correcto", "presenta_fallas"],
      metodo_control: ["peso", "cantidad", "prestamo"],
      motivo_pendiente: ["regla", "posible_duplicado"],
      origen_alias: ["migracion", "busqueda", "fusion"],
      rol_usuario: ["admin", "responsable", "consulta"],
      tipo_movimiento: [
        "carga_inicial",
        "entrada",
        "consumo",
        "merma",
        "ajuste_conteo",
        "prestamo",
        "devolucion",
        "baja",
      ],
      veredicto_pendiente: ["nueva", "duplicado"],
    },
  },
} as const

