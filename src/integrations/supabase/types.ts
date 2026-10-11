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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          commission_percent: number
          id: number
          updated_at: string
        }
        Insert: {
          commission_percent?: number
          id?: number
          updated_at?: string
        }
        Update: {
          commission_percent?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_wallets: {
        Row: {
          balance: number
          driver_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          driver_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          driver_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          order_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          order_id: string
          sender_id: string
          sender_name?: string
          sender_role?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          note: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_note: string
          app_fee: number
          base_fare: number
          code: string
          created_at: string
          dest_address: string
          dest_lat: number
          dest_lng: number
          distance_fare: number
          distance_meters: number
          driver_id: string | null
          duration_seconds: number
          encoded_polyline: string
          fee_charged: boolean
          height_cm: number
          id: string
          item_detail: string
          length_cm: number
          notes: string
          origin_address: string
          origin_lat: number
          origin_lng: number
          oversize_fee: number
          payment_method: string
          recipient_name: string
          recipient_wa: string
          sender_name: string
          sender_wa: string
          service: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
          user_id: string
          weight_kg: number
          width_cm: number
        }
        Insert: {
          admin_note?: string
          app_fee?: number
          base_fare: number
          code?: string
          created_at?: string
          dest_address: string
          dest_lat: number
          dest_lng: number
          distance_fare: number
          distance_meters: number
          driver_id?: string | null
          duration_seconds: number
          encoded_polyline?: string
          fee_charged?: boolean
          height_cm: number
          id?: string
          item_detail: string
          length_cm: number
          notes?: string
          origin_address: string
          origin_lat: number
          origin_lng: number
          oversize_fee?: number
          payment_method: string
          recipient_name?: string
          recipient_wa?: string
          sender_name: string
          sender_wa: string
          service: string
          status?: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at?: string
          user_id: string
          weight_kg: number
          width_cm: number
        }
        Update: {
          admin_note?: string
          app_fee?: number
          base_fare?: number
          code?: string
          created_at?: string
          dest_address?: string
          dest_lat?: number
          dest_lng?: number
          distance_fare?: number
          distance_meters?: number
          driver_id?: string | null
          duration_seconds?: number
          encoded_polyline?: string
          fee_charged?: boolean
          height_cm?: number
          id?: string
          item_detail?: string
          length_cm?: number
          notes?: string
          origin_address?: string
          origin_lat?: number
          origin_lng?: number
          oversize_fee?: number
          payment_method?: string
          recipient_name?: string
          recipient_wa?: string
          sender_name?: string
          sender_wa?: string
          service?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id?: string
          weight_kg?: number
          width_cm?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          driver_id: string
          id: string
          kind: string
          note: string
          order_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          driver_id: string
          id?: string
          kind: string
          note?: string
          order_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string
          id?: string
          kind?: string
          note?: string
          order_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_wallet: {
        Args: { _amount: number; _driver_id: string; _note?: string }
        Returns: number
      }
      admin_review_order: {
        Args: { _approve: boolean; _note?: string; _order_id: string }
        Returns: undefined
      }
      admin_set_commission: { Args: { _percent: number }; Returns: undefined }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      can_access_order: { Args: { _order_id: string }; Returns: boolean }
      cancel_order: {
        Args: { _note?: string; _order_id: string }
        Returns: undefined
      }
      driver_advance_order: {
        Args: { _order_id: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      driver_take_order: { Args: { _order_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_permanent_admin: { Args: { _user_id: string }; Returns: boolean }
      order_app_fee: { Args: { _total: number }; Returns: number }
      wallet_apply: {
        Args: {
          _amount: number
          _driver: string
          _kind: string
          _note: string
          _order: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "superadmin" | "driver" | "user"
      order_status:
        | "menunggu_verifikasi"
        | "ditolak"
        | "tersedia"
        | "diambil"
        | "dijemput"
        | "diantar"
        | "selesai"
        | "dibatalkan"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["superadmin", "driver", "user"],
      order_status: [
        "menunggu_verifikasi",
        "ditolak",
        "tersedia",
        "diambil",
        "dijemput",
        "diantar",
        "selesai",
        "dibatalkan",
      ],
    },
  },
} as const
