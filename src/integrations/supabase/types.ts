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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assessment_attachments: {
        Row: {
          assessment_item_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          uploaded_at: string
        }
        Insert: {
          assessment_item_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          uploaded_at?: string
        }
        Update: {
          assessment_item_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attachments_assessment_item_id_fkey"
            columns: ["assessment_item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_items: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          maturity_level: number | null
          notes: string | null
          recommendation_id: number
          recommended_actions: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          maturity_level?: number | null
          notes?: string | null
          recommendation_id: number
          recommended_actions?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          maturity_level?: number | null
          notes?: string | null
          recommendation_id?: number
          recommended_actions?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_items_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_date: string
          consultant_name: string
          created_at: string
          created_by_user_id: string | null
          customer_id: string
          id: string
          overall_maturity_score: number | null
          parent_assessment_id: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          assessment_date?: string
          consultant_name: string
          created_at?: string
          created_by_user_id?: string | null
          customer_id: string
          id?: string
          overall_maturity_score?: number | null
          parent_assessment_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          assessment_date?: string
          consultant_name?: string
          created_at?: string
          created_by_user_id?: string | null
          customer_id?: string
          id?: string
          overall_maturity_score?: number | null
          parent_assessment_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_parent_assessment_id_fkey"
            columns: ["parent_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          name: string
          operation_type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name: string
          operation_type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name?: string
          operation_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      emergency_plans: {
        Row: {
          additional_notes: string | null
          created_at: string
          created_by_user_id: string
          customer_id: string
          id: string
          it_contact_company: string | null
          it_contact_email: string | null
          it_contact_name: string | null
          it_contact_phone: string | null
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          next_review_at: string | null
          parent_plan_id: string | null
          security_measures: Json | null
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          additional_notes?: string | null
          created_at?: string
          created_by_user_id: string
          customer_id: string
          id?: string
          it_contact_company?: string | null
          it_contact_email?: string | null
          it_contact_name?: string | null
          it_contact_phone?: string | null
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          next_review_at?: string | null
          parent_plan_id?: string | null
          security_measures?: Json | null
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          additional_notes?: string | null
          created_at?: string
          created_by_user_id?: string
          customer_id?: string
          id?: string
          it_contact_company?: string | null
          it_contact_email?: string | null
          it_contact_name?: string | null
          it_contact_phone?: string | null
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          next_review_at?: string | null
          parent_plan_id?: string | null
          security_measures?: Json | null
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "emergency_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_plans_parent_plan_id_fkey"
            columns: ["parent_plan_id"]
            isOneToOne: false
            referencedRelation: "emergency_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string
          description: string
          id: number
          importance_reason: string
          it_recommendations: string | null
          level_1_description: string | null
          level_2_description: string | null
          level_3_description: string | null
          level_4_description: string | null
          number: number
          ot_recommendations: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: number
          importance_reason: string
          it_recommendations?: string | null
          level_1_description?: string | null
          level_2_description?: string | null
          level_3_description?: string | null
          level_4_description?: string | null
          number: number
          ot_recommendations?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: number
          importance_reason?: string
          it_recommendations?: string | null
          level_1_description?: string | null
          level_2_description?: string | null
          level_3_description?: string | null
          level_4_description?: string | null
          number?: number
          ot_recommendations?: string | null
          title?: string
        }
        Relationships: []
      }
      security_report_matches: {
        Row: {
          applied: boolean | null
          assessment_item_id: string | null
          created_at: string
          id: string
          match_confidence: number | null
          recommendation_id: number | null
          report_recommendation_name: string
          report_status: string | null
          security_report_id: string
          suggested_maturity_level: number | null
        }
        Insert: {
          applied?: boolean | null
          assessment_item_id?: string | null
          created_at?: string
          id?: string
          match_confidence?: number | null
          recommendation_id?: number | null
          report_recommendation_name: string
          report_status?: string | null
          security_report_id: string
          suggested_maturity_level?: number | null
        }
        Update: {
          applied?: boolean | null
          assessment_item_id?: string | null
          created_at?: string
          id?: string
          match_confidence?: number | null
          recommendation_id?: number | null
          report_recommendation_name?: string
          report_status?: string | null
          security_report_id?: string
          suggested_maturity_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "security_report_matches_assessment_item_id_fkey"
            columns: ["assessment_item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_report_matches_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_report_matches_security_report_id_fkey"
            columns: ["security_report_id"]
            isOneToOne: false
            referencedRelation: "security_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      security_reports: {
        Row: {
          analysis_result: Json | null
          analysis_status: string | null
          created_at: string
          created_by_user_id: string | null
          customer_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          overall_status_percentage: number | null
          report_type: string | null
          secure_score_current: number | null
          secure_score_predicted: number | null
          updated_at: string
        }
        Insert: {
          analysis_result?: Json | null
          analysis_status?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          overall_status_percentage?: number | null
          report_type?: string | null
          secure_score_current?: number | null
          secure_score_predicted?: number | null
          updated_at?: string
        }
        Update: {
          analysis_result?: Json | null
          analysis_status?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          overall_status_percentage?: number | null
          report_type?: string | null
          secure_score_current?: number | null
          secure_score_predicted?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_reports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
