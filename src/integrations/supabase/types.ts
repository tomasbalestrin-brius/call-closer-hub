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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      calls: {
        Row: {
          ai_summary: string | null
          analyzed_at: string | null
          call_date: string
          call_time: string | null
          client_id: string | null
          client_name: string
          closer_classification:
            | Database["public"]["Enums"]["closer_classification"]
            | null
          closer_id: string
          consciousness_level: string | null
          created_at: string
          decision_reason: string | null
          duration_minutes: number | null
          entry_value: number | null
          google_doc_id: string | null
          has_partner: boolean | null
          id: string
          lead_classification:
            | Database["public"]["Enums"]["lead_classification"]
            | null
          loss_point: string | null
          main_difficulty: string | null
          main_errors: string[] | null
          main_pain: string | null
          main_wins: string[] | null
          next_contact_date: string | null
          niche: string | null
          notes: string | null
          product: string | null
          sale_value: number | null
          score: number | null
          source_file_id: string | null
          status: Database["public"]["Enums"]["call_status"]
          technical_analysis: Json | null
          transcription: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          analyzed_at?: string | null
          call_date?: string
          call_time?: string | null
          client_id?: string | null
          client_name: string
          closer_classification?:
            | Database["public"]["Enums"]["closer_classification"]
            | null
          closer_id: string
          consciousness_level?: string | null
          created_at?: string
          decision_reason?: string | null
          duration_minutes?: number | null
          entry_value?: number | null
          google_doc_id?: string | null
          has_partner?: boolean | null
          id?: string
          lead_classification?:
            | Database["public"]["Enums"]["lead_classification"]
            | null
          loss_point?: string | null
          main_difficulty?: string | null
          main_errors?: string[] | null
          main_pain?: string | null
          main_wins?: string[] | null
          next_contact_date?: string | null
          niche?: string | null
          notes?: string | null
          product?: string | null
          sale_value?: number | null
          score?: number | null
          source_file_id?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          technical_analysis?: Json | null
          transcription?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          analyzed_at?: string | null
          call_date?: string
          call_time?: string | null
          client_id?: string | null
          client_name?: string
          closer_classification?:
            | Database["public"]["Enums"]["closer_classification"]
            | null
          closer_id?: string
          consciousness_level?: string | null
          created_at?: string
          decision_reason?: string | null
          duration_minutes?: number | null
          entry_value?: number | null
          google_doc_id?: string | null
          has_partner?: boolean | null
          id?: string
          lead_classification?:
            | Database["public"]["Enums"]["lead_classification"]
            | null
          loss_point?: string | null
          main_difficulty?: string | null
          main_errors?: string[] | null
          main_pain?: string | null
          main_wins?: string[] | null
          next_contact_date?: string | null
          niche?: string | null
          notes?: string | null
          product?: string | null
          sale_value?: number | null
          score?: number | null
          source_file_id?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          technical_analysis?: Json | null
          transcription?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          closer_id: string
          company: string | null
          contract_validity: string | null
          created_at: string
          email: string | null
          entry_value: number | null
          has_partner: boolean | null
          id: string
          is_sold: boolean | null
          main_difficulty: string | null
          main_pain: string | null
          name: string
          negotiation_notes: string | null
          niche: string | null
          notes: string | null
          phone: string | null
          revenue: number | null
          sale_notes: string | null
          sale_value: number | null
          sold_at: string | null
          source: Database["public"]["Enums"]["client_source"] | null
          updated_at: string
        }
        Insert: {
          closer_id: string
          company?: string | null
          contract_validity?: string | null
          created_at?: string
          email?: string | null
          entry_value?: number | null
          has_partner?: boolean | null
          id?: string
          is_sold?: boolean | null
          main_difficulty?: string | null
          main_pain?: string | null
          name: string
          negotiation_notes?: string | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          revenue?: number | null
          sale_notes?: string | null
          sale_value?: number | null
          sold_at?: string | null
          source?: Database["public"]["Enums"]["client_source"] | null
          updated_at?: string
        }
        Update: {
          closer_id?: string
          company?: string | null
          contract_validity?: string | null
          created_at?: string
          email?: string | null
          entry_value?: number | null
          has_partner?: boolean | null
          id?: string
          is_sold?: boolean | null
          main_difficulty?: string | null
          main_pain?: string | null
          name?: string
          negotiation_notes?: string | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          revenue?: number | null
          sale_notes?: string | null
          sale_value?: number | null
          sold_at?: string | null
          source?: Database["public"]["Enums"]["client_source"] | null
          updated_at?: string
        }
        Relationships: []
      }
      imported_files: {
        Row: {
          call_id: string | null
          created_at: string
          drive_file_id: string
          error_message: string | null
          file_name: string
          id: string
          imported_at: string
          status: Database["public"]["Enums"]["import_status"]
          user_id: string
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          drive_file_id: string
          error_message?: string | null
          file_name: string
          id?: string
          imported_at?: string
          status?: Database["public"]["Enums"]["import_status"]
          user_id: string
        }
        Update: {
          call_id?: string | null
          created_at?: string
          drive_file_id?: string
          error_message?: string | null
          file_name?: string
          id?: string
          imported_at?: string
          status?: Database["public"]["Enums"]["import_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_files_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          drive_auto_import: boolean | null
          drive_file_types: Json | null
          drive_folder_id: string | null
          drive_folder_name: string | null
          drive_import_frequency:
            | Database["public"]["Enums"]["import_frequency"]
            | null
          drive_last_sync: string | null
          drive_name_patterns: Json | null
          full_name: string
          google_access_token: string | null
          google_connected: boolean | null
          google_email: string | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          id: string
          phone: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          drive_auto_import?: boolean | null
          drive_file_types?: Json | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          drive_import_frequency?:
            | Database["public"]["Enums"]["import_frequency"]
            | null
          drive_last_sync?: string | null
          drive_name_patterns?: Json | null
          full_name: string
          google_access_token?: string | null
          google_connected?: boolean | null
          google_email?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          phone?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          drive_auto_import?: boolean | null
          drive_file_types?: Json | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          drive_import_frequency?:
            | Database["public"]["Enums"]["import_frequency"]
            | null
          drive_last_sync?: string | null
          drive_name_patterns?: Json | null
          full_name?: string
          google_access_token?: string | null
          google_connected?: boolean | null
          google_email?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          phone?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_followup_notification: {
        Args: { p_message: string; p_title: string; p_user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      call_status:
        | "pendente"
        | "em_andamento"
        | "follow_up"
        | "proposta_enviada"
        | "vendido"
        | "perdido"
      client_source: "manual" | "google_drive"
      closer_classification:
        | "iniciante"
        | "intermediario"
        | "avancado"
        | "alta_performance"
        | "elite"
      import_frequency: "manual" | "hourly" | "daily" | "realtime"
      import_status: "pending" | "processing" | "completed" | "error"
      lead_classification: "pos_venda" | "follow"
      user_role: "admin" | "closer"
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
      call_status: [
        "pendente",
        "em_andamento",
        "follow_up",
        "proposta_enviada",
        "vendido",
        "perdido",
      ],
      client_source: ["manual", "google_drive"],
      closer_classification: [
        "iniciante",
        "intermediario",
        "avancado",
        "alta_performance",
        "elite",
      ],
      import_frequency: ["manual", "hourly", "daily", "realtime"],
      import_status: ["pending", "processing", "completed", "error"],
      lead_classification: ["pos_venda", "follow"],
      user_role: ["admin", "closer"],
    },
  },
} as const
