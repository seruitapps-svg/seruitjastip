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
          announcement_active: boolean
          announcement_text: string | null
          announcement_type: string
          base_fare: number
          commission_percent: number
          id: number
          jastip_commission_percent: number
          jastip_max_price: number
          jastip_min_price: number
          jastip_nebeng_fee: number | null
          jastip_package_fee: number
          jastip_service_fee: number
          ojek_base_fare: number
          ojek_per_km: number
          oversize_fee: number
          per_km: number
          updated_at: string
        }
        Insert: {
          announcement_active?: boolean
          announcement_text?: string | null
          announcement_type?: string
          base_fare?: number
          commission_percent?: number
          id?: number
          jastip_commission_percent?: number
          jastip_max_price?: number
          jastip_min_price?: number
          jastip_nebeng_fee?: number | null
          jastip_package_fee?: number
          jastip_service_fee?: number
          ojek_base_fare?: number
          ojek_per_km?: number
          oversize_fee?: number
          per_km?: number
          updated_at?: string
        }
        Update: {
          announcement_active?: boolean
          announcement_text?: string | null
          announcement_type?: string
          base_fare?: number
          commission_percent?: number
          id?: number
          jastip_commission_percent?: number
          jastip_max_price?: number
          jastip_min_price?: number
          jastip_nebeng_fee?: number | null
          jastip_package_fee?: number
          jastip_service_fee?: number
          ojek_base_fare?: number
          ojek_per_km?: number
          oversize_fee?: number
          per_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_profiles: {
        Row: {
          accepts_ojek: boolean
          admin_note: string | null
          created_at: string
          full_name: string
          id: string
          is_online: boolean
          nik: string
          phone: string
          photo_ktp: string | null
          photo_selfie: string | null
          photo_sim: string | null
          photo_vehicle: string | null
          status: Database["public"]["Enums"]["driver_registration_status"]
          updated_at: string
          user_id: string
          vehicle_plate: string
          vehicle_type: string
        }
        Insert: {
          accepts_ojek?: boolean
          admin_note?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_online?: boolean
          nik: string
          phone: string
          photo_ktp?: string | null
          photo_selfie?: string | null
          photo_sim?: string | null
          photo_vehicle?: string | null
          status?: Database["public"]["Enums"]["driver_registration_status"]
          updated_at?: string
          user_id: string
          vehicle_plate: string
          vehicle_type: string
        }
        Update: {
          accepts_ojek?: boolean
          admin_note?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_online?: boolean
          nik?: string
          phone?: string
          photo_ktp?: string | null
          photo_selfie?: string | null
          photo_sim?: string | null
          photo_vehicle?: string | null
          status?: Database["public"]["Enums"]["driver_registration_status"]
          updated_at?: string
          user_id?: string
          vehicle_plate?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      driver_wallets: {
        Row: {
          balance: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          bank_updated_at: string | null
          driver_id: string
          earnings_balance: number
          updated_at: string
        }
        Insert: {
          balance?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_updated_at?: string | null
          driver_id: string
          earnings_balance?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_updated_at?: string | null
          driver_id?: string
          earnings_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_withdrawals: {
        Row: {
          admin_note: string
          amount: number
          bank_account_name: string
          bank_account_number: string
          bank_name: string
          created_at: string
          driver_id: string
          id: string
          processed_at: string | null
          processed_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transfer_proof_url: string | null
        }
        Insert: {
          admin_note?: string
          amount: number
          bank_account_name: string
          bank_account_number: string
          bank_name: string
          created_at?: string
          driver_id: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_proof_url?: string | null
        }
        Update: {
          admin_note?: string
          amount?: number
          bank_account_name?: string
          bank_account_number?: string
          bank_name?: string
          created_at?: string
          driver_id?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_proof_url?: string | null
        }
        Relationships: []
      }
      jastip_bookings: {
        Row: {
          code: string
          commission_percent: number
          contact_name: string
          contact_wa: string
          created_at: string
          depart_at: string
          dest_label: string
          driver_commission: number
          driver_net: number
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          id: string
          is_for_other: boolean | null
          is_test: boolean | null
          notes: string
          origin_label: string
          package_subtotal: number
          payment_method: string
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          price_per_slot: number
          recipient_name: string | null
          recipient_wa: string | null
          service_fee: number
          service_type: string | null
          shop_name: string | null
          shop_wa: string | null
          slot_type: string
          slots: number
          status: string
          total: number
          trip_id: string
          user_id: string
        }
        Insert: {
          code?: string
          commission_percent?: number
          contact_name: string
          contact_wa: string
          created_at?: string
          depart_at: string
          dest_label: string
          driver_commission?: number
          driver_net?: number
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          id?: string
          is_for_other?: boolean | null
          is_test?: boolean | null
          notes?: string
          origin_label: string
          package_subtotal?: number
          payment_method: string
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          price_per_slot: number
          recipient_name?: string | null
          recipient_wa?: string | null
          service_fee?: number
          service_type?: string | null
          shop_name?: string | null
          shop_wa?: string | null
          slot_type: string
          slots: number
          status?: string
          total: number
          trip_id: string
          user_id: string
        }
        Update: {
          code?: string
          commission_percent?: number
          contact_name?: string
          contact_wa?: string
          created_at?: string
          depart_at?: string
          dest_label?: string
          driver_commission?: number
          driver_net?: number
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          id?: string
          is_for_other?: boolean | null
          is_test?: boolean | null
          notes?: string
          origin_label?: string
          package_subtotal?: number
          payment_method?: string
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          price_per_slot?: number
          recipient_name?: string | null
          recipient_wa?: string | null
          service_fee?: number
          service_type?: string | null
          shop_name?: string | null
          shop_wa?: string | null
          slot_type?: string
          slots?: number
          status?: string
          total?: number
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jastip_bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "jastip_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      jastip_trips: {
        Row: {
          booked: number
          created_at: string
          depart_at: string
          dest_label: string
          driver_id: string
          enable_nebeng: boolean | null
          id: string
          is_test: boolean | null
          nebeng_booked: number | null
          nebeng_price: number | null
          nebeng_quota: number | null
          notes: string
          origin_label: string
          price_per_slot: number
          quota: number
          slot_type: string
          status: string
          updated_at: string
        }
        Insert: {
          booked?: number
          created_at?: string
          depart_at: string
          dest_label: string
          driver_id: string
          enable_nebeng?: boolean | null
          id?: string
          is_test?: boolean | null
          nebeng_booked?: number | null
          nebeng_price?: number | null
          nebeng_quota?: number | null
          notes?: string
          origin_label: string
          price_per_slot: number
          quota: number
          slot_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          booked?: number
          created_at?: string
          depart_at?: string
          dest_label?: string
          driver_id?: string
          enable_nebeng?: boolean | null
          id?: string
          is_test?: boolean | null
          nebeng_booked?: number | null
          nebeng_price?: number | null
          nebeng_quota?: number | null
          notes?: string
          origin_label?: string
          price_per_slot?: number
          quota?: number
          slot_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      merchants: {
        Row: {
          address: string
          commission_percent: number
          created_at: string
          id: string
          image_url: string | null
          is_open: boolean
          latitude: number | null
          longitude: number | null
          name: string
          opening_hours: string | null
          owner_name: string | null
          phone_wa: string | null
          status: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: string
          commission_percent?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_open?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_hours?: string | null
          owner_name?: string | null
          phone_wa?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          commission_percent?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_open?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_hours?: string | null
          owner_name?: string | null
          phone_wa?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
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
      driver_locations: {
        Row: {
          accuracy: number | null
          driver_id: string
          heading: number | null
          latitude: number
          longitude: number
          order_id: string
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          driver_id: string
          heading?: number | null
          latitude: number
          longitude: number
          order_id: string
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          driver_id?: string
          heading?: number | null
          latitude?: number
          longitude?: number
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
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
          commission_percent: number
          consumer_service_fee: number
          created_at: string
          deposit_deduction: number
          dest_address: string
          dest_lat: number
          dest_lng: number
          distance_fare: number
          distance_meters: number
          driver_commission: number
          driver_id: string | null
          driver_net_earnings: number
          duration_seconds: number
          earnings_credited: boolean
          encoded_polyline: string
          fee_charged: boolean
          height_cm: number
          id: string
          is_test: boolean | null
          item_detail: string
          length_cm: number
          monetization_version: number
          notes: string
          origin_address: string
          origin_lat: number
          origin_lng: number
          oversize_fee: number
          passenger_count: number
          payment_method: string
          recipient_name: string
          recipient_wa: string
          sender_name: string
          sender_wa: string
          service: string
          shipping_fare: number
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
          commission_percent?: number
          consumer_service_fee?: number
          created_at?: string
          deposit_deduction?: number
          dest_address: string
          dest_lat: number
          dest_lng: number
          distance_fare: number
          distance_meters: number
          driver_commission?: number
          driver_id?: string | null
          driver_net_earnings?: number
          duration_seconds: number
          earnings_credited?: boolean
          encoded_polyline?: string
          fee_charged?: boolean
          height_cm: number
          id?: string
          is_test?: boolean | null
          item_detail: string
          length_cm: number
          monetization_version?: number
          notes?: string
          origin_address: string
          origin_lat: number
          origin_lng: number
          oversize_fee?: number
          passenger_count?: number
          payment_method: string
          recipient_name?: string
          recipient_wa?: string
          sender_name: string
          sender_wa: string
          service: string
          shipping_fare?: number
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
          commission_percent?: number
          consumer_service_fee?: number
          created_at?: string
          deposit_deduction?: number
          dest_address?: string
          dest_lat?: number
          dest_lng?: number
          distance_fare?: number
          distance_meters?: number
          driver_commission?: number
          driver_id?: string | null
          driver_net_earnings?: number
          duration_seconds?: number
          earnings_credited?: boolean
          encoded_polyline?: string
          fee_charged?: boolean
          height_cm?: number
          id?: string
          is_test?: boolean | null
          item_detail?: string
          length_cm?: number
          monetization_version?: number
          notes?: string
          origin_address?: string
          origin_lat?: number
          origin_lng?: number
          oversize_fee?: number
          passenger_count?: number
          payment_method?: string
          recipient_name?: string
          recipient_wa?: string
          sender_name?: string
          sender_wa?: string
          service?: string
          shipping_fare?: number
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
      user_wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string
          topup_request_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          note?: string
          topup_request_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string
          topup_request_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_topup_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string
          provider: string
          provider_ref: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
          wallet_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string
          provider?: string
          provider_ref?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
          wallet_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string
          provider?: string
          provider_ref?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
          wallet_type?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_type: string
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
          balance_type?: string
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
          balance_type?: string
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
      admin_clean_test_data: { Args: never; Returns: undefined }
      admin_delete_order: { Args: { _order_id: string }; Returns: undefined }
      admin_delete_user: {
        Args: { _target_user_id: string }
        Returns: undefined
      }
      admin_get_financial_overview: { Args: never; Returns: Json }
      admin_review_driver_withdrawal: {
        Args: {
          p_action: string
          p_admin_note?: string
          p_proof_url?: string
          p_withdrawal_id: string
        }
        Returns: Json
      }
      admin_review_order: {
        Args: { _approve: boolean; _note?: string; _order_id: string }
        Returns: undefined
      }
      admin_review_wallet_topup: {
        Args: { _approve: boolean; _note?: string; _request_id: string }
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
      admin_update_app_settings: {
        Args: {
          _announcement_active: boolean
          _announcement_text: string
          _announcement_type: string
          _base_fare: number
          _commission_percent: number
          _oversize_fee: number
          _per_km: number
        }
        Returns: undefined
      }
      admin_update_mode_settings:
        | {
            Args: {
              _jastip_max_price: number
              _jastip_min_price: number
              _ojek_base_fare: number
              _ojek_per_km: number
            }
            Returns: undefined
          }
        | {
            Args: {
              _jastip_commission_percent: number
              _jastip_package_fee: number
              _jastip_service_fee: number
              _ojek_base_fare: number
              _ojek_per_km: number
            }
            Returns: undefined
          }
      book_jastip_slot:
        | {
            Args: {
              _dropoff_address?: string
              _dropoff_lat?: number
              _dropoff_lng?: number
              _is_for_other?: boolean
              _notes?: string
              _payment?: string
              _pickup_address?: string
              _pickup_lat?: number
              _pickup_lng?: number
              _recipient_name?: string
              _recipient_wa?: string
              _service_type?: string
              _shop_name?: string
              _shop_wa?: string
              _slots?: number
              _trip_id: string
            }
            Returns: string
          }
        | {
            Args: {
              _dropoff_address?: string
              _name: string
              _notes: string
              _payment: string
              _pickup_address?: string
              _slots: number
              _trip_id: string
              _wa: string
            }
            Returns: string
          }
        | {
            Args: {
              _dropoff_address?: string
              _dropoff_lat?: number
              _dropoff_lng?: number
              _name: string
              _notes: string
              _payment: string
              _pickup_address: string
              _pickup_lat?: number
              _pickup_lng?: number
              _slots: number
              _trip_id: string
              _wa: string
            }
            Returns: string
          }
      can_access_order: { Args: { _order_id: string }; Returns: boolean }
      cancel_jastip_booking: {
        Args: { _booking_id: string }
        Returns: undefined
      }
      cancel_order: {
        Args: { _note?: string; _order_id: string }
        Returns: undefined
      }
      driver_advance_order: {
        Args: { _order_id: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      driver_create_trip: {
        Args: {
          _depart_at: string
          _dest: string
          _enable_nebeng?: boolean
          _nebeng_price?: number
          _nebeng_quota?: number
          _notes?: string
          _origin: string
          _price?: number
          _quota?: number
          _slot_type?: string
        }
        Returns: string
      }
      driver_request_withdrawal: { Args: { _amount: number }; Returns: string }
      driver_set_bank_account: {
        Args: {
          _account_name: string
          _account_number: string
          _bank_name: string
        }
        Returns: undefined
      }
      driver_set_trip_status: {
        Args: { _status: string; _trip_id: string }
        Returns: undefined
      }
      driver_take_order: { Args: { _order_id: string }; Returns: undefined }
      driver_toggle_ojek: { Args: { _enabled: boolean }; Returns: undefined }
      driver_toggle_online: { Args: { _enabled: boolean }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_permanent_admin: { Args: { _user_id: string }; Returns: boolean }
      jastip_booking_driver: {
        Args: { _booking_id: string }
        Returns: {
          full_name: string
          phone: string
          vehicle_plate: string
          vehicle_type: string
        }[]
      }
      jastip_catalog: {
        Args: never
        Returns: {
          booked_slots: number
          depart_at: string
          dest_area: string
          enable_nebeng: boolean
          id: string
          nebeng_booked: number
          nebeng_price: number
          nebeng_quota: number
          notes: string
          origin_area: string
          price_per_slot: number
          quota: number
          slot_type: string
          status: string
        }[]
      }
      order_app_fee: { Args: { _total: number }; Returns: number }
      request_wallet_topup: {
        Args: { _amount: number; _wallet_type: string }
        Returns: string
      }
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
      app_role: "superadmin" | "driver" | "mitra" | "user"
      driver_registration_status: "pending" | "approved" | "rejected"
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
      app_role: ["superadmin", "driver", "mitra", "user"],
      driver_registration_status: ["pending", "approved", "rejected"],
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
