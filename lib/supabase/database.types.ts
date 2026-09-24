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
      agent_logs: {
        Row: {
          agent_id: string
          created_at: string
          error_code: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string
          output_tokens: number | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          output_tokens?: number | null
          success: boolean
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          output_tokens?: number | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      daily_challenges: {
        Row: {
          action_id: string
          completed_at: string | null
          date: string
          id: string
          roll_count: number
          user_id: string
        }
        Insert: {
          action_id: string
          completed_at?: string | null
          date: string
          id?: string
          roll_count?: number
          user_id: string
        }
        Update: {
          action_id?: string
          completed_at?: string | null
          date?: string
          id?: string
          roll_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenges_action_owner_fkey"
            columns: ["action_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_actions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      glow_points: {
        Row: {
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: Database["public"]["Enums"]["goal_category"]
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          start_date: string
          target_date: string
          title: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["goal_category"]
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          start_date: string
          target_date: string
          title: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["goal_category"]
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          start_date?: string
          target_date?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          habit_id: string
          id: string
          points_awarded: number
          user_id: string
        }
        Insert: {
          completed: boolean
          created_at?: string
          date: string
          habit_id: string
          id?: string
          points_awarded?: number
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          habit_id?: string
          id?: string
          points_awarded?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_owner_fkey"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          created_at: string
          frequency: Json
          id: string
          longest_streak: number
          name: string
          reminder_time: string | null
          streak: number
          type: Database["public"]["Enums"]["habit_type"]
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          frequency?: Json
          id?: string
          longest_streak?: number
          name: string
          reminder_time?: string | null
          streak?: number
          type: Database["public"]["Enums"]["habit_type"]
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          frequency?: Json
          id?: string
          longest_streak?: number
          name?: string
          reminder_time?: string | null
          streak?: number
          type?: Database["public"]["Enums"]["habit_type"]
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          ai_emotion: string | null
          ai_next_action: string | null
          ai_strength: string | null
          ai_summary: string | null
          created_at: string
          date: string
          id: string
          mood: string
          mood_score: number
          tags: string[]
          user_id: string
        }
        Insert: {
          ai_emotion?: string | null
          ai_next_action?: string | null
          ai_strength?: string | null
          ai_summary?: string | null
          created_at?: string
          date: string
          id?: string
          mood: string
          mood_score: number
          tags?: string[]
          user_id: string
        }
        Update: {
          ai_emotion?: string | null
          ai_next_action?: string | null
          ai_strength?: string | null
          ai_summary?: string | null
          created_at?: string
          date?: string
          id?: string
          mood?: string
          mood_score?: number
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          completed_at: string | null
          due_date: string | null
          goal_id: string
          id: string
          sort_order: number
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          due_date?: string | null
          goal_id: string
          id?: string
          sort_order?: number
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          due_date?: string | null
          goal_id?: string
          id?: string
          sort_order?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_goal_owner_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      point_ledger: {
        Row: {
          created_at: string
          date: string
          event: Database["public"]["Enums"]["point_event"]
          id: string
          points: number
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          event: Database["public"]["Enums"]["point_event"]
          id?: string
          points: number
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          event?: Database["public"]["Enums"]["point_event"]
          id?: string
          points?: number
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          timezone: string
        }
        Insert: {
          created_at?: string
          id: string
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: string
          timezone?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          agent_id: string
          count: number
          date: string
          user_id: string
        }
        Insert: {
          agent_id: string
          count?: number
          date: string
          user_id: string
        }
        Update: {
          agent_id?: string
          count?: number
          date?: string
          user_id?: string
        }
        Relationships: []
      }
      user_actions: {
        Row: {
          action_text: string
          created_at: string
          id: string
          source_summary: string
          source_url: string | null
          status: Database["public"]["Enums"]["action_status"]
          user_id: string
        }
        Insert: {
          action_text: string
          created_at?: string
          id?: string
          source_summary: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          user_id: string
        }
        Update: {
          action_text?: string
          created_at?: string
          id?: string
          source_summary?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_points: {
        Args: {
          p_date: string
          p_event: Database["public"]["Enums"]["point_event"]
          p_points: number
          p_ref_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      seed_daily_challenge: { Args: never; Returns: number }
    }
    Enums: {
      action_status: "pending" | "active" | "done" | "skipped"
      goal_category:
        | "health"
        | "career"
        | "learning"
        | "relationships"
        | "finance"
        | "other"
      habit_type: "build" | "break"
      point_event:
        | "build_habit"
        | "break_habit"
        | "perfect_day"
        | "daily_challenge"
        | "weekly_streak"
        | "goal_complete"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      action_status: ["pending", "active", "done", "skipped"],
      goal_category: [
        "health",
        "career",
        "learning",
        "relationships",
        "finance",
        "other",
      ],
      habit_type: ["build", "break"],
      point_event: [
        "build_habit",
        "break_habit",
        "perfect_day",
        "daily_challenge",
        "weekly_streak",
        "goal_complete",
      ],
    },
  },
} as const

