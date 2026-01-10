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
      automation_logs: {
        Row: {
          automation_id: string
          client_id: string
          executed_at: string | null
          id: string
          result: Json | null
        }
        Insert: {
          automation_id: string
          client_id: string
          executed_at?: string | null
          id?: string
          result?: Json | null
        }
        Update: {
          automation_id?: string
          client_id?: string
          executed_at?: string | null
          id?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "crm_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          ai_summary: string | null
          analyzed_at: string | null
          call_conclusion: string | null
          call_date: string
          call_time: string | null
          client_id: string | null
          client_name: string
          closer_classification:
            | Database["public"]["Enums"]["closer_classification"]
            | null
          closer_id: string
          company_name: string | null
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
          merged_with_call_id: string | null
          next_contact_date: string | null
          niche: string | null
          notes: string | null
          observation: string | null
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
          call_conclusion?: string | null
          call_date?: string
          call_time?: string | null
          client_id?: string | null
          client_name: string
          closer_classification?:
            | Database["public"]["Enums"]["closer_classification"]
            | null
          closer_id: string
          company_name?: string | null
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
          merged_with_call_id?: string | null
          next_contact_date?: string | null
          niche?: string | null
          notes?: string | null
          observation?: string | null
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
          call_conclusion?: string | null
          call_date?: string
          call_time?: string | null
          client_id?: string | null
          client_name?: string
          closer_classification?:
            | Database["public"]["Enums"]["closer_classification"]
            | null
          closer_id?: string
          company_name?: string | null
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
          merged_with_call_id?: string | null
          next_contact_date?: string | null
          niche?: string | null
          notes?: string | null
          observation?: string | null
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
          {
            foreignKeyName: "calls_merged_with_call_id_fkey"
            columns: ["merged_with_call_id"]
            isOneToOne: false
            referencedRelation: "calls"
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
      client_tag_assignments: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          tag_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tag_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "client_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tags: {
        Row: {
          color: string
          created_at: string | null
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          closer_id: string
          company: string | null
          contract_validity: string | null
          created_at: string
          data_completed_at: string | null
          email: string | null
          entry_value: number | null
          followup_date: string | null
          funnel_source: string | null
          has_partner: boolean | null
          id: string
          incomplete_notification_sent: boolean | null
          is_sold: boolean | null
          is_super_hot: boolean | null
          main_difficulty: string | null
          main_pain: string | null
          name: string
          negotiation_notes: string | null
          niche: string | null
          notes: string | null
          phone: string | null
          product_offered: string | null
          revenue: number | null
          sale_notes: string | null
          sale_value: number | null
          sdr_name: string | null
          sold_at: string | null
          source: Database["public"]["Enums"]["client_source"] | null
          status: string | null
          status_changed_at: string | null
          updated_at: string
        }
        Insert: {
          closer_id: string
          company?: string | null
          contract_validity?: string | null
          created_at?: string
          data_completed_at?: string | null
          email?: string | null
          entry_value?: number | null
          followup_date?: string | null
          funnel_source?: string | null
          has_partner?: boolean | null
          id?: string
          incomplete_notification_sent?: boolean | null
          is_sold?: boolean | null
          is_super_hot?: boolean | null
          main_difficulty?: string | null
          main_pain?: string | null
          name: string
          negotiation_notes?: string | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          product_offered?: string | null
          revenue?: number | null
          sale_notes?: string | null
          sale_value?: number | null
          sdr_name?: string | null
          sold_at?: string | null
          source?: Database["public"]["Enums"]["client_source"] | null
          status?: string | null
          status_changed_at?: string | null
          updated_at?: string
        }
        Update: {
          closer_id?: string
          company?: string | null
          contract_validity?: string | null
          created_at?: string
          data_completed_at?: string | null
          email?: string | null
          entry_value?: number | null
          followup_date?: string | null
          funnel_source?: string | null
          has_partner?: boolean | null
          id?: string
          incomplete_notification_sent?: boolean | null
          is_sold?: boolean | null
          is_super_hot?: boolean | null
          main_difficulty?: string | null
          main_pain?: string | null
          name?: string
          negotiation_notes?: string | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          product_offered?: string | null
          revenue?: number | null
          sale_notes?: string | null
          sale_value?: number | null
          sdr_name?: string | null
          sold_at?: string | null
          source?: Database["public"]["Enums"]["client_source"] | null
          status?: string | null
          status_changed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_automations: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crm_column_settings: {
        Row: {
          column_id: string
          created_at: string | null
          custom_color: string | null
          custom_subtitle: string | null
          custom_title: string | null
          display_order: number | null
          id: string
          is_visible: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          column_id: string
          created_at?: string | null
          custom_color?: string | null
          custom_subtitle?: string | null
          custom_title?: string | null
          display_order?: number | null
          id?: string
          is_visible?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          column_id?: string
          created_at?: string | null
          custom_color?: string | null
          custom_subtitle?: string | null
          custom_title?: string | null
          display_order?: number | null
          id?: string
          is_visible?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_verses: {
        Row: {
          category: string
          created_at: string
          day_of_year: number
          id: string
          reference: string
          verse_text: string
        }
        Insert: {
          category: string
          created_at?: string
          day_of_year: number
          id?: string
          reference: string
          verse_text: string
        }
        Update: {
          category?: string
          created_at?: string
          day_of_year?: number
          id?: string
          reference?: string
          verse_text?: string
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
      indications: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          indicated_by: string
          indicated_email: string | null
          indicated_name: string
          indicated_phone: string
          indication_type: string
          notes: string | null
          status: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          indicated_by: string
          indicated_email?: string | null
          indicated_name: string
          indicated_phone: string
          indication_type: string
          notes?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          indicated_by?: string
          indicated_email?: string | null
          indicated_name?: string
          indicated_phone?: string
          indication_type?: string
          notes?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "portfolio_students"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goals: {
        Row: {
          closer_id: string
          created_at: string
          goal_value: number
          id: string
          month: number
          set_by_user_id: string
          updated_at: string
          year: number
        }
        Insert: {
          closer_id: string
          created_at?: string
          goal_value: number
          id?: string
          month: number
          set_by_user_id: string
          updated_at?: string
          year: number
        }
        Update: {
          closer_id?: string
          created_at?: string
          goal_value?: number
          id?: string
          month?: number
          set_by_user_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
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
      portfolio_students: {
        Row: {
          client_id: string | null
          closer_id: string
          created_at: string
          current_ticket: Database["public"]["Enums"]["ticket_type"]
          email: string | null
          entry_date: string
          id: string
          name: string
          niche: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          closer_id: string
          created_at?: string
          current_ticket?: Database["public"]["Enums"]["ticket_type"]
          email?: string | null
          entry_date?: string
          id?: string
          name: string
          niche?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          closer_id?: string
          created_at?: string
          current_ticket?: Database["public"]["Enums"]["ticket_type"]
          email?: string | null
          entry_date?: string
          id?: string
          name?: string
          niche?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_students_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          closer_level: Database["public"]["Enums"]["closer_level"]
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
          closer_level?: Database["public"]["Enums"]["closer_level"]
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
          closer_level?: Database["public"]["Enums"]["closer_level"]
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
      squad_members: {
        Row: {
          created_at: string | null
          id: string
          squad_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          squad_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      student_activities: {
        Row: {
          activity_date: string
          activity_name: string
          activity_type: Database["public"]["Enums"]["student_activity_type"]
          created_at: string
          id: string
          notes: string | null
          student_id: string
        }
        Insert: {
          activity_date?: string
          activity_name: string
          activity_type: Database["public"]["Enums"]["student_activity_type"]
          created_at?: string
          id?: string
          notes?: string | null
          student_id: string
        }
        Update: {
          activity_date?: string
          activity_name?: string
          activity_type?: Database["public"]["Enums"]["student_activity_type"]
          created_at?: string
          id?: string
          notes?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_activities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "portfolio_students"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_upgrades: {
        Row: {
          created_at: string
          entry_value: number | null
          from_ticket: Database["public"]["Enums"]["ticket_type"]
          id: string
          notes: string | null
          sale_value: number | null
          student_id: string
          to_ticket: Database["public"]["Enums"]["ticket_type"]
          upgrade_date: string
        }
        Insert: {
          created_at?: string
          entry_value?: number | null
          from_ticket: Database["public"]["Enums"]["ticket_type"]
          id?: string
          notes?: string | null
          sale_value?: number | null
          student_id: string
          to_ticket: Database["public"]["Enums"]["ticket_type"]
          upgrade_date?: string
        }
        Update: {
          created_at?: string
          entry_value?: number | null
          from_ticket?: Database["public"]["Enums"]["ticket_type"]
          id?: string
          notes?: string | null
          sale_value?: number | null
          student_id?: string
          to_ticket?: Database["public"]["Enums"]["ticket_type"]
          upgrade_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_upgrades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "portfolio_students"
            referencedColumns: ["id"]
          },
        ]
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
      create_client_notification: {
        Args: {
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      create_followup_notification: {
        Args: { p_message: string; p_title: string; p_user_id: string }
        Returns: undefined
      }
      get_squad_leader_for_closer: {
        Args: { p_closer_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_squad_leader: {
        Args: { _squad_id: string; _user_id: string }
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
      closer_level:
        | "assessor"
        | "executivo"
        | "pro"
        | "elite"
        | "especialista"
        | "especialista_pro"
        | "especialista_elite"
      import_frequency: "manual" | "hourly" | "daily" | "realtime"
      import_status: "pending" | "processing" | "completed" | "error"
      lead_classification: "pos_venda" | "follow"
      student_activity_type: "intensivo" | "mentoria" | "evento"
      ticket_type: "29_90" | "12k" | "80k"
      user_role: "admin" | "closer" | "lider"
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
      closer_level: [
        "assessor",
        "executivo",
        "pro",
        "elite",
        "especialista",
        "especialista_pro",
        "especialista_elite",
      ],
      import_frequency: ["manual", "hourly", "daily", "realtime"],
      import_status: ["pending", "processing", "completed", "error"],
      lead_classification: ["pos_venda", "follow"],
      student_activity_type: ["intensivo", "mentoria", "evento"],
      ticket_type: ["29_90", "12k", "80k"],
      user_role: ["admin", "closer", "lider"],
    },
  },
} as const
