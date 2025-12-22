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
      admin_ticket_assignments: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          is_active: boolean
          ticket_type: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          ticket_type: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          ticket_type?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      cast_receivers: {
        Row: {
          created_at: string | null
          device_name: string
          device_type: string | null
          id: string
          last_active: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_name: string
          device_type?: string | null
          id?: string
          last_active?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_name?: string
          device_type?: string | null
          id?: string
          last_active?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cast_sessions: {
        Row: {
          controller_user_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_playing: boolean | null
          last_heartbeat: string | null
          pairing_code: string
          playback_time: number | null
          queue: Json | null
          receiver_id: string | null
          status: string | null
          video_duration: number | null
          video_thumbnail: string | null
          video_title: string | null
          video_url: string | null
          volume_level: number | null
        }
        Insert: {
          controller_user_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_playing?: boolean | null
          last_heartbeat?: string | null
          pairing_code: string
          playback_time?: number | null
          queue?: Json | null
          receiver_id?: string | null
          status?: string | null
          video_duration?: number | null
          video_thumbnail?: string | null
          video_title?: string | null
          video_url?: string | null
          volume_level?: number | null
        }
        Update: {
          controller_user_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_playing?: boolean | null
          last_heartbeat?: string | null
          pairing_code?: string
          playback_time?: number | null
          queue?: Json | null
          receiver_id?: string | null
          status?: string | null
          video_duration?: number | null
          video_thumbnail?: string | null
          video_title?: string | null
          video_url?: string | null
          volume_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cast_sessions_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "cast_receivers"
            referencedColumns: ["id"]
          },
        ]
      }
      coming_soon: {
        Row: {
          backdrop_url: string | null
          content_type: string
          created_at: string
          description: string | null
          expected_release_date: string | null
          genre: string | null
          id: string
          is_active: boolean
          thumbnail_url: string | null
          title: string
          tmdb_id: number | null
          trailer_url: string | null
          updated_at: string
        }
        Insert: {
          backdrop_url?: string | null
          content_type?: string
          created_at?: string
          description?: string | null
          expected_release_date?: string | null
          genre?: string | null
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title: string
          tmdb_id?: number | null
          trailer_url?: string | null
          updated_at?: string
        }
        Update: {
          backdrop_url?: string | null
          content_type?: string
          created_at?: string
          description?: string | null
          expected_release_date?: string | null
          genre?: string | null
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title?: string
          tmdb_id?: number | null
          trailer_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coming_soon_sync_log: {
        Row: {
          content_id: string | null
          content_type: string
          id: string
          synced_at: string
          title: string
          tmdb_id: number | null
          users_notified: number
        }
        Insert: {
          content_id?: string | null
          content_type: string
          id?: string
          synced_at?: string
          title: string
          tmdb_id?: number | null
          users_notified?: number
        }
        Update: {
          content_id?: string | null
          content_type?: string
          id?: string
          synced_at?: string
          title?: string
          tmdb_id?: number | null
          users_notified?: number
        }
        Relationships: [
          {
            foreignKeyName: "coming_soon_sync_log_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      coming_soon_watchlist: {
        Row: {
          coming_soon_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          coming_soon_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          coming_soon_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coming_soon_watchlist_coming_soon_id_fkey"
            columns: ["coming_soon_id"]
            isOneToOne: false
            referencedRelation: "coming_soon"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coming_soon_watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coming_soon_watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          cast_members: Json | null
          content_rating: string | null
          content_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          director: string | null
          duration: number | null
          genre: string | null
          id: string
          is_premium: boolean | null
          rating: string | null
          thumbnail_url: string | null
          title: string
          tmdb_id: number | null
          updated_at: string | null
          video_url: string | null
          view_count: number | null
          year: number | null
        }
        Insert: {
          cast_members?: Json | null
          content_rating?: string | null
          content_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          director?: string | null
          duration?: number | null
          genre?: string | null
          id?: string
          is_premium?: boolean | null
          rating?: string | null
          thumbnail_url?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
          year?: number | null
        }
        Update: {
          cast_members?: Json | null
          content_rating?: string | null
          content_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          director?: string | null
          duration?: number | null
          genre?: string | null
          id?: string
          is_premium?: boolean | null
          rating?: string | null
          thumbnail_url?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
          year?: number | null
        }
        Relationships: []
      }
      download_licenses: {
        Row: {
          content_id: string
          created_at: string | null
          device_id: string
          downloaded_at: string | null
          encrypted_key: string
          episode_id: string | null
          expires_at: string
          id: string
          last_verified: string | null
          quality: string | null
          status: string | null
          total_size: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string | null
          device_id: string
          downloaded_at?: string | null
          encrypted_key: string
          episode_id?: string | null
          expires_at: string
          id?: string
          last_verified?: string | null
          quality?: string | null
          status?: string | null
          total_size?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string | null
          device_id?: string
          downloaded_at?: string | null
          encrypted_key?: string
          episode_id?: string | null
          expires_at?: string
          id?: string
          last_verified?: string | null
          quality?: string | null
          status?: string | null
          total_size?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_licenses_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_licenses_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      drip_sequence_steps: {
        Row: {
          created_at: string
          delay_days: number
          delay_hours: number
          html_content: string | null
          id: string
          sequence_id: string
          step_order: number
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delay_days?: number
          delay_hours?: number
          html_content?: string | null
          id?: string
          sequence_id: string
          step_order: number
          subject: string
          template_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delay_days?: number
          delay_hours?: number
          html_content?: string | null
          id?: string
          sequence_id?: string
          step_order?: number
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drip_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "drip_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      drip_sequences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_event?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          campaign_type: string
          created_at: string
          created_by: string | null
          filters: Json | null
          html_content: string | null
          id: string
          name: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          target_audience: string
          template_type: string
          updated_at: string
        }
        Insert: {
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          html_content?: string | null
          id?: string
          name: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          target_audience?: string
          template_type?: string
          updated_at?: string
        }
        Update: {
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          html_content?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          target_audience?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          bounce_reason: string | null
          bounce_type: string | null
          bounced_at: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          opened_at: string | null
          recipient_email: string
          sent_at: string
          status: string
          subject: string
          template_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          recipient_email: string
          sent_at?: string
          status?: string
          subject: string
          template_type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          recipient_email?: string
          sent_at?: string
          status?: string
          subject?: string
          template_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      episodes: {
        Row: {
          created_at: string
          description: string | null
          duration: number | null
          episode_number: number
          id: string
          intro_end_time: number | null
          intro_start_time: number | null
          is_premium: boolean | null
          recap_end_time: number | null
          recap_start_time: number | null
          season_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: number | null
          episode_number: number
          id?: string
          intro_end_time?: number | null
          intro_start_time?: number | null
          is_premium?: boolean | null
          recap_end_time?: number | null
          recap_start_time?: number | null
          season_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: number | null
          episode_number?: number
          id?: string
          intro_end_time?: number | null
          intro_start_time?: number | null
          is_premium?: boolean | null
          recap_end_time?: number | null
          recap_start_time?: number | null
          season_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      hero_banners: {
        Row: {
          content_id: string | null
          created_at: string
          cta_link: string | null
          cta_text: string | null
          description: string | null
          display_order: number
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          start_date: string | null
          subtitle: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          description?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          start_date?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          description?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          start_date?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hero_banners_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      home_sections: {
        Row: {
          card_style: string
          content_type_filter: string | null
          created_at: string
          display_order: number
          genre_id: string | null
          id: string
          is_active: boolean
          max_items: number | null
          section_type: string
          title: string
          updated_at: string
        }
        Insert: {
          card_style?: string
          content_type_filter?: string | null
          created_at?: string
          display_order?: number
          genre_id?: string | null
          id?: string
          is_active?: boolean
          max_items?: number | null
          section_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          card_style?: string
          content_type_filter?: string | null
          created_at?: string
          display_order?: number
          genre_id?: string | null
          id?: string
          is_active?: boolean
          max_items?: number | null
          section_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_sections_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_categories: {
        Row: {
          color: string
          created_at: string | null
          display_order: number | null
          emoji: string
          id: string
          is_active: boolean | null
          name: string
          slug: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          display_order?: number | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
        }
        Update: {
          color?: string
          created_at?: string | null
          display_order?: number | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      kids_content_categories: {
        Row: {
          category_id: string
          content_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          category_id: string
          content_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          category_id?: string
          content_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_content_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kids_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_content_categories_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_viewing_history: {
        Row: {
          completed: boolean | null
          content_id: string
          duration_watched_minutes: number | null
          id: string
          profile_id: string
          watched_at: string | null
        }
        Insert: {
          completed?: boolean | null
          content_id: string
          duration_watched_minutes?: number | null
          id?: string
          profile_id: string
          watched_at?: string | null
        }
        Update: {
          completed?: boolean | null
          content_id?: string
          duration_watched_minutes?: number | null
          id?: string
          profile_id?: string
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_viewing_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_viewing_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          coming_soon_alerts: boolean
          created_at: string
          id: string
          kids_bedtime_alerts: boolean
          kids_time_limit_alerts: boolean
          kids_weekly_report: boolean
          new_releases: boolean
          promotional: boolean
          subscription_reminders: boolean
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          coming_soon_alerts?: boolean
          created_at?: string
          id?: string
          kids_bedtime_alerts?: boolean
          kids_time_limit_alerts?: boolean
          kids_weekly_report?: boolean
          new_releases?: boolean
          promotional?: boolean
          subscription_reminders?: boolean
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          coming_soon_alerts?: boolean
          created_at?: string
          id?: string
          kids_bedtime_alerts?: boolean
          kids_time_limit_alerts?: boolean
          kids_weekly_report?: boolean
          new_releases?: boolean
          promotional?: boolean
          subscription_reminders?: boolean
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          content_id: string | null
          created_at: string
          id: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          content_id?: string | null
          created_at?: string
          id?: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          content_id?: string | null
          created_at?: string
          id?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_watch_preferences: {
        Row: {
          created_at: string
          genre: string
          id: string
          profile_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          genre: string
          id?: string
          profile_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          genre?: string
          id?: string
          profile_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_watch_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_session_id: string | null
          avatar_url: string | null
          country: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_subscribed: boolean | null
          last_login_at: string | null
          lockout_count: number | null
          mobile_number: string | null
          parental_controls_enabled: boolean | null
          parental_pin: string | null
          parental_rating_limit: string | null
          pin_attempts: number | null
          pin_code: string | null
          pin_locked_until: string | null
          secret_word: string | null
          subscription_expiry: string | null
          updated_at: string | null
        }
        Insert: {
          active_session_id?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          is_subscribed?: boolean | null
          last_login_at?: string | null
          lockout_count?: number | null
          mobile_number?: string | null
          parental_controls_enabled?: boolean | null
          parental_pin?: string | null
          parental_rating_limit?: string | null
          pin_attempts?: number | null
          pin_code?: string | null
          pin_locked_until?: string | null
          secret_word?: string | null
          subscription_expiry?: string | null
          updated_at?: string | null
        }
        Update: {
          active_session_id?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_subscribed?: boolean | null
          last_login_at?: string | null
          lockout_count?: number | null
          mobile_number?: string | null
          parental_controls_enabled?: boolean | null
          parental_pin?: string | null
          parental_rating_limit?: string | null
          pin_attempts?: number | null
          pin_code?: string | null
          pin_locked_until?: string | null
          secret_word?: string | null
          subscription_expiry?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          content_id: string
          created_at: string
          id: string
          rating: number
          review_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          rating: number
          review_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          created_at: string
          error_message: string | null
          html_content: string
          id: string
          recipient_email: string
          scheduled_for: string
          sent_at: string | null
          source_id: string | null
          source_type: string
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          html_content: string
          id?: string
          recipient_email: string
          scheduled_for: string
          sent_at?: string | null
          source_id?: string | null
          source_type: string
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          html_content?: string
          id?: string
          recipient_email?: string
          scheduled_for?: string
          sent_at?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          content_id: string
          created_at: string
          description: string | null
          id: string
          season_number: number
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          content_id: string
          created_at?: string
          description?: string | null
          id?: string
          season_number: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          content_id?: string
          created_at?: string
          description?: string | null
          id?: string
          season_number?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      section_content: {
        Row: {
          content_id: string
          created_at: string
          display_order: number
          id: string
          section_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          display_order?: number
          id?: string
          section_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          display_order?: number
          id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_content_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_content_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "home_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_credits: {
        Row: {
          created_at: string
          credit_days: number
          granted_by: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_days: number
          granted_by: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credit_days?: number
          granted_by?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscription_settings: {
        Row: {
          base_price: number
          created_at: string | null
          currency: string
          description: string | null
          id: string
          is_active: boolean
          plan_type: string
          updated_at: string | null
        }
        Insert: {
          base_price?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          plan_type?: string
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          plan_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string | null
          currency: string
          discount_percent: number | null
          discount_reason: string | null
          expires_at: string | null
          id: string
          payment_provider: string
          payment_reference: string | null
          plan_type: string
          starts_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string | null
          currency?: string
          discount_percent?: number | null
          discount_reason?: string | null
          expires_at?: string | null
          id?: string
          payment_provider: string
          payment_reference?: string | null
          plan_type: string
          starts_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string | null
          currency?: string
          discount_percent?: number | null
          discount_reason?: string | null
          expires_at?: string | null
          id?: string
          payment_provider?: string
          payment_reference?: string | null
          plan_type?: string
          starts_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          status: string
          subject: string
          ticket_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          status?: string
          subject: string
          ticket_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          ticket_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      top_10: {
        Row: {
          content_id: string
          created_at: string
          id: string
          rank: number
          updated_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          rank: number
          updated_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          rank?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "top_10_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      transcoding_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          episode_id: string
          error_message: string | null
          format: string
          id: string
          last_retry_at: string | null
          max_retries: number | null
          output_url: string | null
          progress: number | null
          retry_count: number | null
          source_url: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          episode_id: string
          error_message?: string | null
          format?: string
          id?: string
          last_retry_at?: string | null
          max_retries?: number | null
          output_url?: string | null
          progress?: number | null
          retry_count?: number | null
          source_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          episode_id?: string
          error_message?: string | null
          format?: string
          id?: string
          last_retry_at?: string | null
          max_retries?: number | null
          output_url?: string | null
          progress?: number | null
          retry_count?: number | null
          source_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcoding_jobs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_drip_enrollments: {
        Row: {
          completed_at: string | null
          current_step: number
          enrolled_at: string
          id: string
          next_email_at: string | null
          sequence_id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_step?: number
          enrolled_at?: string
          id?: string
          next_email_at?: string | null
          sequence_id: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_step?: number
          enrolled_at?: string
          id?: string
          next_email_at?: string | null
          sequence_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_drip_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "drip_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bedtime_time: string | null
          created_at: string
          daily_time_limit_minutes: number | null
          id: string
          is_kids: boolean
          last_time_reset: string | null
          name: string
          time_watched_today_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bedtime_time?: string | null
          created_at?: string
          daily_time_limit_minutes?: number | null
          id?: string
          is_kids?: boolean
          last_time_reset?: string | null
          name: string
          time_watched_today_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bedtime_time?: string | null
          created_at?: string
          daily_time_limit_minutes?: number | null
          id?: string
          is_kids?: boolean
          last_time_reset?: string | null
          name?: string
          time_watched_today_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      walkthrough_screens: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          content_id: string
          id: string
          last_watched: string | null
          progress: number | null
          user_id: string
        }
        Insert: {
          content_id: string
          id?: string
          last_watched?: string | null
          progress?: number | null
          user_id: string
        }
        Update: {
          content_id?: string
          id?: string
          last_watched?: string | null
          progress?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          content_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_banners: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          image_url: string
          is_active: boolean | null
          link_url: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          image_url: string
          is_active?: boolean | null
          link_url?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_url?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      youtube_channels: {
        Row: {
          channel_id: string
          cover_url: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          subscriber_count: string | null
          thumbnail_url: string | null
          updated_at: string | null
          video_count: number | null
        }
        Insert: {
          channel_id: string
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          subscriber_count?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_count?: number | null
        }
        Update: {
          channel_id?: string
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          subscriber_count?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_count?: number | null
        }
        Relationships: []
      }
      youtube_playlists: {
        Row: {
          channel_id: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          playlist_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_count: number | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          playlist_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_count?: number | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          playlist_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_playlists_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_videos: {
        Row: {
          created_at: string | null
          description: string | null
          duration: number | null
          id: string
          playlist_id: string | null
          position: number | null
          published_at: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_id: string
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          playlist_id?: string | null
          position?: number | null
          published_at?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_id: string
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          playlist_id?: string | null
          position?: number | null
          published_at?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_videos_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "youtube_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_watchlist: {
        Row: {
          added_at: string
          channel_name: string | null
          duration: number | null
          id: string
          thumbnail_url: string | null
          user_id: string
          video_id: string
          video_title: string
        }
        Insert: {
          added_at?: string
          channel_name?: string | null
          duration?: number | null
          id?: string
          thumbnail_url?: string | null
          user_id: string
          video_id: string
          video_title: string
        }
        Update: {
          added_at?: string
          channel_name?: string | null
          duration?: number | null
          id?: string
          thumbnail_url?: string | null
          user_id?: string
          video_id?: string
          video_title?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_safe: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_subscribed: boolean | null
          last_login_at: string | null
          parental_controls_enabled: boolean | null
          parental_rating_limit: string | null
          subscription_expiry: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_subscribed?: boolean | null
          last_login_at?: string | null
          parental_controls_enabled?: boolean | null
          parental_rating_limit?: string | null
          subscription_expiry?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_subscribed?: boolean | null
          last_login_at?: string | null
          parental_controls_enabled?: boolean | null
          parental_rating_limit?: string | null
          subscription_expiry?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions_safe: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string | null
          plan_type: string | null
          starts_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          plan_type?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          plan_type?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_reset_pin: {
        Args: { target_user_id: string }
        Returns: {
          error_message: string
          success: boolean
          user_email: string
        }[]
      }
      admin_reset_secret_word: {
        Args: { new_secret: string; target_user_id: string }
        Returns: {
          error_message: string
          success: boolean
          user_email: string
        }[]
      }
      check_mobile_exists: { Args: { check_mobile: string }; Returns: boolean }
      get_masked_mobile: { Args: { user_uuid: string }; Returns: string }
      get_subscription_summary: {
        Args: { user_uuid: string }
        Returns: {
          expires_at: string
          is_active: boolean
          plan_type: string
          starts_at: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      reset_pin_secure: {
        Args: { input_secret: string; new_pin: string; user_mobile: string }
        Returns: {
          error_message: string
          success: boolean
        }[]
      }
      update_mobile_number: { Args: { new_mobile: string }; Returns: boolean }
      verify_parental_pin: {
        Args: { input_pin: string; user_uuid: string }
        Returns: boolean
      }
      verify_pin_code: {
        Args: { input_pin: string; user_mobile: string }
        Returns: {
          is_locked: boolean
          is_valid: boolean
          lock_until: string
          user_id: string
        }[]
      }
      verify_secret_word: {
        Args: { input_secret: string; user_mobile: string }
        Returns: {
          is_valid: boolean
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "super_admin"
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
      app_role: ["admin", "moderator", "user", "super_admin"],
    },
  },
} as const
