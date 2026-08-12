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
        }
        Insert: {
          activo?: boolean
          clave: string
          creado_en?: string
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          clave?: string
          creado_en?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      articulo: {
        Row: {
          clasificacion: Database["public"]["Enums"]["clasificacion_articulo"]
          creado_en: string
          creado_por: string | null
          descripcion: string | null
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
        ]
      }
      articulo_reactivo: {
        Row: {
          articulo_id: number
          caracteristica_fisica: string | null
          caracteristica_quimica: string | null
          clasificacion_ghs: string | null
          color_almacenamiento: string | null
          estado_fisico: Database["public"]["Enums"]["estado_fisico"] | null
          peligro_especial: string | null
          requiere_hoja_seguridad: boolean | null
          riesgo_inflamabilidad: number | null
          riesgo_reactividad: number | null
          riesgo_salud: number | null
          uso_principal: string | null
        }
        Insert: {
          articulo_id: number
          caracteristica_fisica?: string | null
          caracteristica_quimica?: string | null
          clasificacion_ghs?: string | null
          color_almacenamiento?: string | null
          estado_fisico?: Database["public"]["Enums"]["estado_fisico"] | null
          peligro_especial?: string | null
          requiere_hoja_seguridad?: boolean | null
          riesgo_inflamabilidad?: number | null
          riesgo_reactividad?: number | null
          riesgo_salud?: number | null
          uso_principal?: string | null
        }
        Update: {
          articulo_id?: number
          caracteristica_fisica?: string | null
          caracteristica_quimica?: string | null
          clasificacion_ghs?: string | null
          color_almacenamiento?: string | null
          estado_fisico?: Database["public"]["Enums"]["estado_fisico"] | null
          peligro_especial?: string | null
          requiere_hoja_seguridad?: boolean | null
          riesgo_inflamabilidad?: number | null
          riesgo_reactividad?: number | null
          riesgo_salud?: number | null
          uso_principal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articulo_reactivo_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: true
            referencedRelation: "articulo"
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
          codigo: string | null
          creado_en: string
          estado: Database["public"]["Enums"]["estado_existencia"]
          fecha_adquisicion: string | null
          fecha_caducidad: string | null
          id: number
          marca: string | null
          numero_inventario_uaeh: string | null
          numero_serie: string | null
          presentacion: string | null
          ubicacion_id: number | null
        }
        Insert: {
          almacen_id: number
          articulo_id: number
          cantidad?: number
          cantidad_minima?: number | null
          codigo?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_existencia"]
          fecha_adquisicion?: string | null
          fecha_caducidad?: string | null
          id?: never
          marca?: string | null
          numero_inventario_uaeh?: string | null
          numero_serie?: string | null
          presentacion?: string | null
          ubicacion_id?: number | null
        }
        Update: {
          almacen_id?: number
          articulo_id?: number
          cantidad?: number
          cantidad_minima?: number | null
          codigo?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_existencia"]
          fecha_adquisicion?: string | null
          fecha_caducidad?: string | null
          id?: never
          marca?: string | null
          numero_inventario_uaeh?: string | null
          numero_serie?: string | null
          presentacion?: string | null
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
            foreignKeyName: "existencia_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: false
            referencedRelation: "articulo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "existencia_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "ubicacion"
            referencedColumns: ["id"]
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
        ]
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
            foreignKeyName: "movimiento_existencia_id_fkey"
            columns: ["existencia_id"]
            isOneToOne: false
            referencedRelation: "existencia"
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
        ]
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
        ]
      }
    }
    Views: {
      [_ in never]: never
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
      fusionar_articulo: {
        Args: { destino: number; origen: number }
        Returns: undefined
      }
      norm_texto: { Args: { t: string }; Returns: string }
    }
    Enums: {
      clasificacion_articulo:
        | "reactivo"
        | "material"
        | "insumo"
        | "equipo"
        | "componente"
      estado_existencia:
        | "por_confirmar"
        | "disponible"
        | "stock_bajo"
        | "agotado"
        | "contaminado"
        | "mantenimiento"
        | "baja"
      estado_fisico: "solido" | "liquido" | "gas"
      origen_alias: "migracion" | "busqueda" | "fusion"
      rol_usuario: "admin" | "responsable" | "consulta"
      tipo_movimiento:
        | "entrada"
        | "consumo"
        | "merma"
        | "ajuste_conteo"
        | "prestamo"
        | "devolucion"
        | "baja"
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
      ],
      estado_existencia: [
        "por_confirmar",
        "disponible",
        "stock_bajo",
        "agotado",
        "contaminado",
        "mantenimiento",
        "baja",
      ],
      estado_fisico: ["solido", "liquido", "gas"],
      origen_alias: ["migracion", "busqueda", "fusion"],
      rol_usuario: ["admin", "responsable", "consulta"],
      tipo_movimiento: [
        "entrada",
        "consumo",
        "merma",
        "ajuste_conteo",
        "prestamo",
        "devolucion",
        "baja",
      ],
    },
  },
} as const

