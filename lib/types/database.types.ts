export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      downtime_reasons: {
        Row: {
          active: boolean
          category: string
          code: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          from_location_id: string | null
          id: string
          lot_id: string | null
          material_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          quantity: number
          reason_code: string | null
          reference_doc: string | null
          to_location_id: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          from_location_id?: string | null
          id?: string
          lot_id?: string | null
          material_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          quantity: number
          reason_code?: string | null
          reference_doc?: string | null
          to_location_id?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          from_location_id?: string | null
          id?: string
          lot_id?: string | null
          material_id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          quantity?: number
          reason_code?: string | null
          reference_doc?: string | null
          to_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "material_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          code: string
          id: string
          machine_id: string | null
          name: string
          type: Database["public"]["Enums"]["location_type"]
        }
        Insert: {
          active?: boolean
          code: string
          id?: string
          machine_id?: string | null
          name: string
          type: Database["public"]["Enums"]["location_type"]
        }
        Update: {
          active?: boolean
          code?: string
          id?: string
          machine_id?: string | null
          name?: string
          type?: Database["public"]["Enums"]["location_type"]
        }
        Relationships: [
          {
            foreignKeyName: "locations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_downtime_events: {
        Row: {
          closed_by: string | null
          created_by: string
          device_id: string | null
          end_time: string | null
          id: string
          machine_id: string
          notes: string | null
          reason_id: string
          shift_instance_id: string
          source: string
          start_time: string
        }
        Insert: {
          closed_by?: string | null
          created_by: string
          device_id?: string | null
          end_time?: string | null
          id?: string
          machine_id: string
          notes?: string | null
          reason_id: string
          shift_instance_id: string
          source?: string
          start_time?: string
        }
        Update: {
          closed_by?: string | null
          created_by?: string
          device_id?: string | null
          end_time?: string | null
          id?: string
          machine_id?: string
          notes?: string | null
          reason_id?: string
          shift_instance_id?: string
          source?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_downtime_events_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_downtime_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_downtime_events_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_downtime_events_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "downtime_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_downtime_events_shift_instance_id_fkey"
            columns: ["shift_instance_id"]
            isOneToOne: false
            referencedRelation: "shift_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_downtime_events_shift_instance_id_fkey"
            columns: ["shift_instance_id"]
            isOneToOne: false
            referencedRelation: "v_oee_by_shift"
            referencedColumns: ["shift_instance_id"]
          },
        ]
      }
      machines: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          ideal_run_rate_per_hour: number | null
          machine_type: string | null
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          ideal_run_rate_per_hour?: number | null
          machine_type?: string | null
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          ideal_run_rate_per_hour?: number | null
          machine_type?: string | null
          name?: string
        }
        Relationships: []
      }
      material_lots: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          lot_code: string
          material_id: string
          received_date: string | null
          supplier: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          lot_code: string
          material_id: string
          received_date?: string | null
          supplier?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          lot_code?: string
          material_id?: string
          received_date?: string | null
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_lots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_lots_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          material_type: Database["public"]["Enums"]["material_type"]
          min_stock: number
          name: string
          unit_of_measure: Database["public"]["Enums"]["uom"]
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          material_type?: Database["public"]["Enums"]["material_type"]
          min_stock?: number
          name: string
          unit_of_measure?: Database["public"]["Enums"]["uom"]
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          material_type?: Database["public"]["Enums"]["material_type"]
          min_stock?: number
          name?: string
          unit_of_measure?: Database["public"]["Enums"]["uom"]
        }
        Relationships: [
          {
            foreignKeyName: "materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      production_counts: {
        Row: {
          created_by: string
          device_id: string | null
          good_qty: number
          id: string
          machine_id: string
          recorded_at: string
          reject_qty: number
          reject_reason: string | null
          shift_instance_id: string
          source: string
        }
        Insert: {
          created_by: string
          device_id?: string | null
          good_qty?: number
          id?: string
          machine_id: string
          recorded_at?: string
          reject_qty?: number
          reject_reason?: string | null
          shift_instance_id: string
          source?: string
        }
        Update: {
          created_by?: string
          device_id?: string | null
          good_qty?: number
          id?: string
          machine_id?: string
          recorded_at?: string
          reject_qty?: number
          reject_reason?: string | null
          shift_instance_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_counts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_counts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_counts_shift_instance_id_fkey"
            columns: ["shift_instance_id"]
            isOneToOne: false
            referencedRelation: "shift_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_counts_shift_instance_id_fkey"
            columns: ["shift_instance_id"]
            isOneToOne: false
            referencedRelation: "v_oee_by_shift"
            referencedColumns: ["shift_instance_id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      shift_catalog: {
        Row: {
          active: boolean
          code: string
          end_time: string
          id: string
          name: string
          start_time: string
        }
        Insert: {
          active?: boolean
          code: string
          end_time: string
          id?: string
          name: string
          start_time: string
        }
        Update: {
          active?: boolean
          code?: string
          end_time?: string
          id?: string
          name?: string
          start_time?: string
        }
        Relationships: []
      }
      shift_instances: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          created_by: string
          id: string
          machine_id: string
          operator_id: string | null
          planned_end: string
          planned_start: string
          run_date: string
          shift_id: string
          status: Database["public"]["Enums"]["shift_status"]
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by: string
          id?: string
          machine_id: string
          operator_id?: string | null
          planned_end: string
          planned_start: string
          run_date?: string
          shift_id: string
          status?: Database["public"]["Enums"]["shift_status"]
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by?: string
          id?: string
          machine_id?: string
          operator_id?: string | null
          planned_end?: string
          planned_start?: string
          run_date?: string
          shift_id?: string
          status?: Database["public"]["Enums"]["shift_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shift_instances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_instances_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_instances_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_instances_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_inventory_stock: {
        Row: {
          location_id: string | null
          lot_id: string | null
          material_id: string | null
          quantity: number | null
        }
        Relationships: []
      }
      v_oee_by_shift: {
        Row: {
          good_qty: number | null
          ideal_run_rate_per_hour: number | null
          machine_id: string | null
          planned_production_seconds: number | null
          reject_qty: number | null
          run_seconds: number | null
          shift_instance_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_instances_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_outbound_movement: {
        Args: {
          p_from_location_id?: string
          p_lot_id?: string
          p_material_id: string
          p_movement_type: Database["public"]["Enums"]["movement_type"]
          p_notes?: string
          p_quantity?: number
          p_reference_doc?: string
          p_to_location_id?: string
        }
        Returns: string
      }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      location_type: "bodega" | "piso" | "maquina" | "externo" | "merma"
      material_type: "resina" | "masterbatch" | "aditivo" | "otro"
      movement_type: "entrada" | "salida" | "traslado" | "consumo" | "ajuste"
      shift_status: "abierto" | "cerrado"
      uom: "kg" | "g" | "ton" | "bulto" | "unidad" | "cuñete"
      user_role: "operario" | "supervisor" | "admin"
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
  public: {
    Enums: {
      location_type: ["bodega", "piso", "maquina", "externo", "merma"],
      material_type: ["resina", "masterbatch", "aditivo", "otro"],
      movement_type: ["entrada", "salida", "traslado", "consumo", "ajuste"],
      shift_status: ["abierto", "cerrado"],
      uom: ["kg", "g", "ton", "bulto", "unidad", "cuñete"],
      user_role: ["operario", "supervisor", "admin"],
    },
  },
} as const
