export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          created_at: string | null
          id: number
          new_value: string | null
          old_value: string | null
          operation: string
          record_id: string
          target_table: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          new_value?: string | null
          old_value?: string | null
          operation: string
          record_id: string
          target_table: string
        }
        Update: {
          created_at?: string | null
          id?: number
          new_value?: string | null
          old_value?: string | null
          operation?: string
          record_id?: string
          target_table?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      auth_sync_queue: {
        Row: {
          created_at: string | null
          processed: boolean | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          processed?: boolean | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          processed?: boolean | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          active: boolean | null
          bot_message: string | null
          conversation_id: string | null
          created_at: string | null
          id: number
          message_type: string | null
          phone: string | null
          user_message: string | null
        }
        Insert: {
          active?: boolean | null
          bot_message?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: number
          message_type?: string | null
          phone?: string | null
          user_message?: string | null
        }
        Update: {
          active?: boolean | null
          bot_message?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: number
          message_type?: string | null
          phone?: string | null
          user_message?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          email_to: string
          error_message: string | null
          id: string
          sent_at: string | null
          sequence_id: string | null
          status: string
          subject: string
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          email_to: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          sequence_id?: string | null
          status: string
          subject: string
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          email_to?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          sequence_id?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          active: boolean | null
          created_at: string | null
          days_after_signup: number
          id: string
          name: string
          send_hour: number | null
          send_type: string
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          days_after_signup: number
          id?: string
          name: string
          send_hour?: number | null
          send_type?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          days_after_signup?: number
          id?: string
          name?: string
          send_hour?: number | null
          send_type?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sequences_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          active: boolean | null
          body: string
          created_at: string | null
          id: string
          name: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          body: string
          created_at?: string | null
          id?: string
          name: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          body?: string
          created_at?: string | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          scheduled_at: string | null
          sent_at: string | null
          target_audience: string
          target_details: Json | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          scheduled_at?: string | null
          sent_at?: string | null
          target_audience?: string
          target_details?: Json | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          scheduled_at?: string | null
          sent_at?: string | null
          target_audience?: string
          target_details?: Json | null
          title?: string
        }
        Relationships: []
      }
      radio_suggestions: {
        Row: {
          additional_info: string | null
          city: string
          contact_email: string | null
          country: string | null
          created_at: string
          id: number
          radio_name: string
          state: string
          status: string
          stream_url: string | null
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          additional_info?: string | null
          city: string
          contact_email?: string | null
          country?: string | null
          created_at?: string
          id?: number
          radio_name: string
          state: string
          status?: string
          stream_url?: string | null
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          additional_info?: string | null
          city?: string
          contact_email?: string | null
          country?: string | null
          created_at?: string
          id?: number
          radio_name?: string
          state?: string
          status?: string
          stream_url?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sendpulse_lists: {
        Row: {
          created_at: string | null
          description: string | null
          external_id: string
          id: number
          name: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          external_id: string
          id?: number
          name: string
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          external_id?: string
          id?: number
          name?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: number
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: number
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          favorite_radios: string[] | null
          first_login_at: string | null
          full_name: string | null
          id: string
          last_payment_date: string | null
          last_sign_in_at: string | null
          payment_status: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          stripe_customer_id: string | null
          subscription_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          favorite_radios?: string[] | null
          first_login_at?: string | null
          full_name?: string | null
          id: string
          last_payment_date?: string | null
          last_sign_in_at?: string | null
          payment_status?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          stripe_customer_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          favorite_radios?: string[] | null
          first_login_at?: string | null
          full_name?: string | null
          id?: string
          last_payment_date?: string | null
          last_sign_in_at?: string | null
          payment_status?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          stripe_customer_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      whatsapp_configurations: {
        Row: {
          config_key: string
          config_value: string | null
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value?: string | null
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      user_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_favorite_radios_column: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      alter_users_add_favorite_radios: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      bytea_to_text: {
        Args: {
          data: string
        }
        Returns: string
      }
      check_admin_status: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_auth_sync_queue_structure: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      delete_user_admin: {
        Args: {
          user_id: string
        }
        Returns: undefined
      }
      exec_sql: {
        Args: {
          sql_query: string
        }
        Returns: Json
      }
      get_pending_emails: {
        Args: {
          p_current_hour?: number
        }
        Returns: {
          user_id: string
          email: string
          full_name: string
          first_login_at: string
          sequence_id: string
          template_id: string
          subject: string
          body: string
          send_type: string
        }[]
      }
      get_sendpulse_list_id: {
        Args: {
          user_status: string
        }
        Returns: string
      }
      http: {
        Args: {
          request: Database["public"]["CompositeTypes"]["http_request"]
        }
        Returns: unknown
      }
      http_delete:
        | {
            Args: {
              uri: string
            }
            Returns: unknown
          }
        | {
            Args: {
              uri: string
              content: string
              content_type: string
            }
            Returns: unknown
          }
      http_get:
        | {
            Args: {
              uri: string
            }
            Returns: unknown
          }
        | {
            Args: {
              uri: string
              data: Json
            }
            Returns: unknown
          }
      http_head: {
        Args: {
          uri: string
        }
        Returns: unknown
      }
      http_header: {
        Args: {
          field: string
          value: string
        }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: {
          uri: string
          content: string
          content_type: string
        }
        Returns: unknown
      }
      http_post:
        | {
            Args: {
              uri: string
              content: string
              content_type: string
            }
            Returns: unknown
          }
        | {
            Args: {
              uri: string
              data: Json
            }
            Returns: unknown
          }
      http_put: {
        Args: {
          uri: string
          content: string
          content_type: string
        }
        Returns: unknown
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: {
          curlopt: string
          value: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      text_to_bytea: {
        Args: {
          data: string
        }
        Returns: string
      }
      update_expired_trial_users: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_user_status: {
        Args: {
          p_user_id: string
          p_new_status: string
          p_admin_id: string
        }
        Returns: Json
      }
      update_users_last_sign_in: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      urlencode:
        | {
            Args: {
              data: Json
            }
            Returns: string
          }
        | {
            Args: {
              string: string
            }
            Returns: string
          }
        | {
            Args: {
              string: string
            }
            Returns: string
          }
    }
    Enums: {
      user_status: "ATIVO" | "INATIVO" | "ADMIN" | "TRIAL"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
