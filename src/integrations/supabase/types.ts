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
      cast_events: {
        Row: {
          actor: string
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          session_id: string | null
        }
        Insert: {
          actor: string
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          session_id?: string | null
        }
        Update: {
          actor?: string
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cast_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cast_sessions"
            referencedColumns: ["id"]
          },
        ]
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
          command_payload: Json | null
          command_seq: number | null
          command_type: string | null
          command_updated_at: string | null
          controller_last_heartbeat: string | null
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
          receiver_is_playing: boolean | null
          receiver_playback_time: number | null
          status: string | null
          video_duration: number | null
          video_thumbnail: string | null
          video_title: string | null
          video_url: string | null
          volume_level: number | null
        }
        Insert: {
          command_payload?: Json | null
          command_seq?: number | null
          command_type?: string | null
          command_updated_at?: string | null
          controller_last_heartbeat?: string | null
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
          receiver_is_playing?: boolean | null
          receiver_playback_time?: number | null
          status?: string | null
          video_duration?: number | null
          video_thumbnail?: string | null
          video_title?: string | null
          video_url?: string | null
          volume_level?: number | null
        }
        Update: {
          command_payload?: Json | null
          command_seq?: number | null
          command_type?: string | null
          command_updated_at?: string | null
          controller_last_heartbeat?: string | null
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
          receiver_is_playing?: boolean | null
          receiver_playback_time?: number | null
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
      channel_subscriptions: {
        Row: {
          channel_id: string
          id: string
          notifications_enabled: boolean
          subscribed_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          notifications_enabled?: boolean
          subscribed_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          notifications_enabled?: boolean
          subscribed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_subscriptions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
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
          admin_override: boolean | null
          age_limit: number | null
          cast_members: Json | null
          content_rating: string | null
          content_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          director: string | null
          duration: number | null
          expires_at: string | null
          genre: string | null
          id: string
          is_premium: boolean | null
          lifecycle_reason: string | null
          lifecycle_status: string | null
          lifecycle_updated_at: string | null
          rating: string | null
          thumbnail_url: string | null
          title: string
          tmdb_id: number | null
          updated_at: string | null
          video_url: string | null
          view_count: number | null
          views_last_30_days: number | null
          year: number | null
        }
        Insert: {
          admin_override?: boolean | null
          age_limit?: number | null
          cast_members?: Json | null
          content_rating?: string | null
          content_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          director?: string | null
          duration?: number | null
          expires_at?: string | null
          genre?: string | null
          id?: string
          is_premium?: boolean | null
          lifecycle_reason?: string | null
          lifecycle_status?: string | null
          lifecycle_updated_at?: string | null
          rating?: string | null
          thumbnail_url?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
          views_last_30_days?: number | null
          year?: number | null
        }
        Update: {
          admin_override?: boolean | null
          age_limit?: number | null
          cast_members?: Json | null
          content_rating?: string | null
          content_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          director?: string | null
          duration?: number | null
          expires_at?: string | null
          genre?: string | null
          id?: string
          is_premium?: boolean | null
          lifecycle_reason?: string | null
          lifecycle_status?: string | null
          lifecycle_updated_at?: string | null
          rating?: string | null
          thumbnail_url?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
          views_last_30_days?: number | null
          year?: number | null
        }
        Relationships: []
      }
      content_lifecycle_logs: {
        Row: {
          admin_id: string | null
          changed_by: string
          content_id: string
          created_at: string
          id: string
          new_status: string
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          admin_id?: string | null
          changed_by?: string
          content_id: string
          created_at?: string
          id?: string
          new_status: string
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          admin_id?: string | null
          changed_by?: string
          content_id?: string
          created_at?: string
          id?: string
          new_status?: string
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_lifecycle_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      content_purchases: {
        Row: {
          amount: number
          content_id: string
          created_at: string
          creator_id: string
          creator_share: number
          currency: string
          id: string
          paid_content_id: string
          payment_provider: string
          payment_reference: string | null
          platform_share: number
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          content_id: string
          created_at?: string
          creator_id: string
          creator_share: number
          currency?: string
          id?: string
          paid_content_id: string
          payment_provider: string
          payment_reference?: string | null
          platform_share: number
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          content_id?: string
          created_at?: string
          creator_id?: string
          creator_share?: number
          currency?: string
          id?: string
          paid_content_id?: string
          payment_provider?: string
          payment_reference?: string | null
          platform_share?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_purchases_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_purchases_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_purchases_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_purchases_paid_content_id_fkey"
            columns: ["paid_content_id"]
            isOneToOne: false
            referencedRelation: "paid_content"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_analytics: {
        Row: {
          created_at: string
          creator_id: string
          date: string
          id: string
          new_followers: number
          revenue: number
          sales: number
          tips_received: number
          unique_viewers: number
          views: number
          watch_time_minutes: number
        }
        Insert: {
          created_at?: string
          creator_id: string
          date: string
          id?: string
          new_followers?: number
          revenue?: number
          sales?: number
          tips_received?: number
          unique_viewers?: number
          views?: number
          watch_time_minutes?: number
        }
        Update: {
          created_at?: string
          creator_id?: string
          date?: string
          id?: string
          new_followers?: number
          revenue?: number
          sales?: number
          tips_received?: number
          unique_viewers?: number
          views?: number
          watch_time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_analytics_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_analytics_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_applications: {
        Row: {
          created_at: string
          description: string
          id: string
          portfolio_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          portfolio_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          portfolio_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_content_submissions: {
        Row: {
          age_group: string | null
          content_id: string | null
          content_type: string | null
          cover_image_url: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          duration: number | null
          genre: string | null
          id: string
          poster_image_url: string | null
          price_per_view: number | null
          rejection_reason: string | null
          release_date: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          title: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          age_group?: string | null
          content_id?: string | null
          content_type?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          duration?: number | null
          genre?: string | null
          id?: string
          poster_image_url?: string | null
          price_per_view?: number | null
          rejection_reason?: string | null
          release_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          age_group?: string | null
          content_id?: string | null
          content_type?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          duration?: number | null
          genre?: string | null
          id?: string
          poster_image_url?: string | null
          price_per_view?: number | null
          rejection_reason?: string | null
          release_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_content_submissions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_content_submissions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_content_submissions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_followers: {
        Row: {
          creator_id: string
          followed_at: string
          follower_user_id: string
          id: string
        }
        Insert: {
          creator_id: string
          followed_at?: string
          follower_user_id: string
          id?: string
        }
        Update: {
          creator_id?: string
          followed_at?: string
          follower_user_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_followers_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_followers_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_imported_content: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          duration: number | null
          id: string
          imported_content_id: string | null
          is_imported_to_content: boolean
          like_count: number | null
          original_published_at: string | null
          platform: string
          platform_content_id: string
          social_account_id: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          video_url: string | null
          view_count: number | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          duration?: number | null
          id?: string
          imported_content_id?: string | null
          is_imported_to_content?: boolean
          like_count?: number | null
          original_published_at?: string | null
          platform: string
          platform_content_id: string
          social_account_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_url?: string | null
          view_count?: number | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          duration?: number | null
          id?: string
          imported_content_id?: string | null
          is_imported_to_content?: boolean
          like_count?: number | null
          original_published_at?: string | null
          platform?: string
          platform_content_id?: string
          social_account_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_url?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_imported_content_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_imported_content_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_imported_content_imported_content_id_fkey"
            columns: ["imported_content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_imported_content_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "creator_social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_kyc: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          created_at: string | null
          creator_id: string
          date_of_birth: string | null
          email: string
          full_name: string
          id: string
          id_document_url: string
          id_expiry_date: string | null
          id_number: string
          id_type: string
          nationality: string | null
          phone_number: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          created_at?: string | null
          creator_id: string
          date_of_birth?: string | null
          email: string
          full_name: string
          id?: string
          id_document_url: string
          id_expiry_date?: string | null
          id_number: string
          id_type: string
          nationality?: string | null
          phone_number: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          created_at?: string | null
          creator_id?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string
          id?: string
          id_document_url?: string
          id_expiry_date?: string | null
          id_number?: string
          id_type?: string
          nationality?: string | null
          phone_number?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_kyc_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_kyc_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payouts: {
        Row: {
          amount: number
          approved_by: string | null
          creator_id: string
          currency: string
          error_message: string | null
          flutterwave_ref: string | null
          id: string
          notes: string | null
          payout_details: Json
          payout_method: string
          processed_at: string | null
          requested_at: string
          status: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          creator_id: string
          currency?: string
          error_message?: string | null
          flutterwave_ref?: string | null
          id?: string
          notes?: string | null
          payout_details: Json
          payout_method: string
          processed_at?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          creator_id?: string
          currency?: string
          error_message?: string | null
          flutterwave_ref?: string | null
          id?: string
          notes?: string | null
          payout_details?: Json
          payout_method?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          can_request_payout: boolean | null
          cover_url: string | null
          created_at: string
          display_name: string
          follower_count: number
          id: string
          is_active: boolean
          is_verified: boolean
          kyc_status: string | null
          kyc_verified_at: string | null
          payout_details: Json | null
          payout_method: string | null
          pending_balance: number
          total_earnings: number
          total_tips_received: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          can_request_payout?: boolean | null
          cover_url?: string | null
          created_at?: string
          display_name: string
          follower_count?: number
          id?: string
          is_active?: boolean
          is_verified?: boolean
          kyc_status?: string | null
          kyc_verified_at?: string | null
          payout_details?: Json | null
          payout_method?: string | null
          pending_balance?: number
          total_earnings?: number
          total_tips_received?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          can_request_payout?: boolean | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          follower_count?: number
          id?: string
          is_active?: boolean
          is_verified?: boolean
          kyc_status?: string | null
          kyc_verified_at?: string | null
          payout_details?: Json | null
          payout_method?: string | null
          pending_balance?: number
          total_earnings?: number
          total_tips_received?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_reports: {
        Row: {
          creator_id: string
          email_sent_at: string | null
          generated_at: string
          id: string
          period_end: string
          period_start: string
          report_data: Json | null
          report_type: string
        }
        Insert: {
          creator_id: string
          email_sent_at?: string | null
          generated_at?: string
          id?: string
          period_end: string
          period_start: string
          report_data?: Json | null
          report_type: string
        }
        Update: {
          creator_id?: string
          email_sent_at?: string | null
          generated_at?: string
          id?: string
          period_end?: string
          period_start?: string
          report_data?: Json | null
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_reports_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_reports_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_social_accounts: {
        Row: {
          access_token: string | null
          created_at: string
          creator_id: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          platform: string
          platform_user_id: string | null
          platform_username: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          creator_id: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          platform: string
          platform_user_id?: string | null
          platform_username?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          platform?: string
          platform_user_id?: string | null
          platform_username?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_social_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_social_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_tips: {
        Row: {
          amount: number
          created_at: string
          creator_id: string
          currency: string
          id: string
          message: string | null
          payment_provider: string
          payment_reference: string | null
          status: string
          tipper_user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          creator_id: string
          currency?: string
          id?: string
          message?: string | null
          payment_provider: string
          payment_reference?: string | null
          status?: string
          tipper_user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          creator_id?: string
          currency?: string
          id?: string
          message?: string | null
          payment_provider?: string
          payment_reference?: string | null
          status?: string
          tipper_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_tips_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_tips_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
        ]
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
      email_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          html_content: string
          id: string
          is_active: boolean
          name: string
          subject: string
          template_key: string
          updated_at: string
          updated_by: string | null
          variables: Json | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          html_content: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          template_key: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          html_content?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          template_key?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
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
      featured_creators: {
        Row: {
          banner_image_url: string
          created_at: string | null
          creator_id: string
          cta_label: string | null
          end_at: string | null
          id: string
          priority: number | null
          start_at: string | null
          status: string | null
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          banner_image_url: string
          created_at?: string | null
          creator_id: string
          cta_label?: string | null
          end_at?: string | null
          id?: string
          priority?: number | null
          start_at?: string | null
          status?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          banner_image_url?: string
          created_at?: string | null
          creator_id?: string
          cta_label?: string | null
          end_at?: string | null
          id?: string
          priority?: number | null
          start_at?: string | null
          status?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_creators_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_creators_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      free_content_analytics: {
        Row: {
          content_id: string
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          section_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          content_id: string
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          section_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          section_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "free_content_analytics_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "free_content_analytics_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "home_sections"
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
          video_duration: number | null
          video_start_time: number | null
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
          video_duration?: number | null
          video_start_time?: number | null
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
          video_duration?: number | null
          video_start_time?: number | null
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
          allow_duplicates: boolean
          card_style: string
          content_type_filter: string | null
          created_at: string
          display_order: number
          genre_id: string | null
          id: string
          is_active: boolean
          is_curated: boolean
          max_items: number | null
          section_type: string
          show_on_desktop: boolean
          show_on_kids: boolean
          show_on_mobile: boolean
          title: string
          updated_at: string
          year_filter: number | null
        }
        Insert: {
          allow_duplicates?: boolean
          card_style?: string
          content_type_filter?: string | null
          created_at?: string
          display_order?: number
          genre_id?: string | null
          id?: string
          is_active?: boolean
          is_curated?: boolean
          max_items?: number | null
          section_type?: string
          show_on_desktop?: boolean
          show_on_kids?: boolean
          show_on_mobile?: boolean
          title: string
          updated_at?: string
          year_filter?: number | null
        }
        Update: {
          allow_duplicates?: boolean
          card_style?: string
          content_type_filter?: string | null
          created_at?: string
          display_order?: number
          genre_id?: string | null
          id?: string
          is_active?: boolean
          is_curated?: boolean
          max_items?: number | null
          section_type?: string
          show_on_desktop?: boolean
          show_on_kids?: boolean
          show_on_mobile?: boolean
          title?: string
          updated_at?: string
          year_filter?: number | null
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
      homepage_ads: {
        Row: {
          ab_test_id: string | null
          contexts: Json
          created_at: string
          cta_internal_route: string | null
          cta_label: string | null
          cta_url: string | null
          end_at: string | null
          id: string
          kids_safe: boolean
          poster_url: string
          priority: number
          start_at: string | null
          status: string
          subscription_target: string | null
          subtitle: string | null
          targeting: Json | null
          title: string
          updated_at: string
          variant: string | null
          video_type: string | null
          video_url: string | null
          weight: number
        }
        Insert: {
          ab_test_id?: string | null
          contexts?: Json
          created_at?: string
          cta_internal_route?: string | null
          cta_label?: string | null
          cta_url?: string | null
          end_at?: string | null
          id?: string
          kids_safe?: boolean
          poster_url: string
          priority?: number
          start_at?: string | null
          status?: string
          subscription_target?: string | null
          subtitle?: string | null
          targeting?: Json | null
          title: string
          updated_at?: string
          variant?: string | null
          video_type?: string | null
          video_url?: string | null
          weight?: number
        }
        Update: {
          ab_test_id?: string | null
          contexts?: Json
          created_at?: string
          cta_internal_route?: string | null
          cta_label?: string | null
          cta_url?: string | null
          end_at?: string | null
          id?: string
          kids_safe?: boolean
          poster_url?: string
          priority?: number
          start_at?: string | null
          status?: string
          subscription_target?: string | null
          subtitle?: string | null
          targeting?: Json | null
          title?: string
          updated_at?: string
          variant?: string | null
          video_type?: string | null
          video_url?: string | null
          weight?: number
        }
        Relationships: []
      }
      homepage_ads_events: {
        Row: {
          ad_id: string
          app_context: string | null
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          session_id: string
          user_id: string | null
          user_is_subscribed: boolean | null
          variant: string | null
        }
        Insert: {
          ad_id: string
          app_context?: string | null
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          session_id: string
          user_id?: string | null
          user_is_subscribed?: boolean | null
          variant?: string | null
        }
        Update: {
          ad_id?: string
          app_context?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          session_id?: string
          user_id?: string | null
          user_is_subscribed?: boolean | null
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homepage_ads_events_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "homepage_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_approved_content: {
        Row: {
          approved_at: string
          content_id: string
          id: string
          notes: string | null
          parent_user_id: string
          profile_id: string
        }
        Insert: {
          approved_at?: string
          content_id: string
          id?: string
          notes?: string | null
          parent_user_id: string
          profile_id: string
        }
        Update: {
          approved_at?: string
          content_id?: string
          id?: string
          notes?: string | null
          parent_user_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_approved_content_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_approved_content_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
      kids_content_restrictions: {
        Row: {
          content_id: string
          created_at: string
          id: string
          notes: string | null
          parent_user_id: string
          profile_id: string
          restriction_type: string
          updated_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          notes?: string | null
          parent_user_id: string
          profile_id: string
          restriction_type: string
          updated_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          parent_user_id?: string
          profile_id?: string
          restriction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_content_restrictions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_content_restrictions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
      kyc_access_logs: {
        Row: {
          accessed_at: string
          accessed_by: string
          action: string
          creator_id: string | null
          details: Json | null
          id: string
          ip_address: string | null
          kyc_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          accessed_by: string
          action: string
          creator_id?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          kyc_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          accessed_by?: string
          action?: string
          creator_id?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          kyc_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_access_logs_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_access_logs_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_access_logs_kyc_id_fkey"
            columns: ["kyc_id"]
            isOneToOne: false
            referencedRelation: "creator_kyc"
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
      paid_content: {
        Row: {
          content_id: string
          created_at: string
          creator_id: string
          currency: string
          id: string
          is_active: boolean
          is_free: boolean
          price: number
          sale_count: number
          total_revenue: number
          updated_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          creator_id: string
          currency?: string
          id?: string
          is_active?: boolean
          is_free?: boolean
          price: number
          sale_count?: number
          total_revenue?: number
          updated_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          creator_id?: string
          currency?: string
          id?: string
          is_active?: boolean
          is_free?: boolean
          price?: number
          sale_count?: number
          total_revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_content_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paid_content_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paid_content_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      playable_games: {
        Row: {
          age_group: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          embed_type: string
          embed_url: string
          featured: boolean | null
          health_status: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          languages: string[] | null
          last_health_check: string | null
          play_count: number | null
          source: string
          source_id: string | null
          source_url: string | null
          subject: string | null
          tags: string[] | null
          thumbnail_url: string
          title: string
          updated_at: string | null
        }
        Insert: {
          age_group?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          embed_type: string
          embed_url: string
          featured?: boolean | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          languages?: string[] | null
          last_health_check?: string | null
          play_count?: number | null
          source: string
          source_id?: string | null
          source_url?: string | null
          subject?: string | null
          tags?: string[] | null
          thumbnail_url: string
          title: string
          updated_at?: string | null
        }
        Update: {
          age_group?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          embed_type?: string
          embed_url?: string
          featured?: boolean | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          languages?: string[] | null
          last_health_check?: string | null
          play_count?: number | null
          source?: string
          source_id?: string | null
          source_url?: string | null
          subject?: string | null
          tags?: string[] | null
          thumbnail_url?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      premium_conversion_tracking: {
        Row: {
          created_at: string
          days_to_convert: number | null
          first_free_content_at: string | null
          free_content_count: number | null
          free_content_viewed: Json | null
          id: string
          subscription_plan: string | null
          subscription_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_to_convert?: number | null
          first_free_content_at?: string | null
          free_content_count?: number | null
          free_content_viewed?: Json | null
          id?: string
          subscription_plan?: string | null
          subscription_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_to_convert?: number | null
          first_free_content_at?: string | null
          free_content_count?: number | null
          free_content_viewed?: Json | null
          id?: string
          subscription_plan?: string | null
          subscription_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_backgrounds: {
        Row: {
          content_type: string | null
          created_at: string | null
          desktop_image_url: string | null
          display_order: number | null
          end_date: string | null
          id: string
          is_active: boolean | null
          mobile_image_url: string | null
          start_date: string | null
          title: string
          tmdb_id: number | null
          updated_at: string | null
          video_duration: number | null
          video_start_time: number | null
          video_url: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          desktop_image_url?: string | null
          display_order?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          mobile_image_url?: string | null
          start_date?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string | null
          video_duration?: number | null
          video_start_time?: number | null
          video_url?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          desktop_image_url?: string | null
          display_order?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          mobile_image_url?: string | null
          start_date?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string | null
          video_duration?: number | null
          video_start_time?: number | null
          video_url?: string | null
        }
        Relationships: []
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
      rate_limits: {
        Row: {
          action: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          action?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
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
      series_subscriptions: {
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
            foreignKeyName: "series_subscriptions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
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
      subtitle_edit_history: {
        Row: {
          created_at: string
          edit_type: string
          edited_by: string
          id: string
          new_content: string | null
          previous_content: string | null
          subtitle_id: string
        }
        Insert: {
          created_at?: string
          edit_type: string
          edited_by: string
          id?: string
          new_content?: string | null
          previous_content?: string | null
          subtitle_id: string
        }
        Update: {
          created_at?: string
          edit_type?: string
          edited_by?: string
          id?: string
          new_content?: string | null
          previous_content?: string | null
          subtitle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtitle_edit_history_subtitle_id_fkey"
            columns: ["subtitle_id"]
            isOneToOne: false
            referencedRelation: "subtitles"
            referencedColumns: ["id"]
          },
        ]
      }
      subtitle_generation_logs: {
        Row: {
          completed_at: string | null
          content_id: string | null
          created_at: string | null
          episode_id: string | null
          error_message: string | null
          id: string
          languages_generated: string[] | null
          metadata: Json | null
          started_at: string | null
          status: string
          transcription_model: string | null
          updated_at: string | null
          video_duration_seconds: number | null
          video_url: string | null
        }
        Insert: {
          completed_at?: string | null
          content_id?: string | null
          created_at?: string | null
          episode_id?: string | null
          error_message?: string | null
          id?: string
          languages_generated?: string[] | null
          metadata?: Json | null
          started_at?: string | null
          status?: string
          transcription_model?: string | null
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Update: {
          completed_at?: string | null
          content_id?: string | null
          created_at?: string | null
          episode_id?: string | null
          error_message?: string | null
          id?: string
          languages_generated?: string[] | null
          metadata?: Json | null
          started_at?: string | null
          status?: string
          transcription_model?: string | null
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtitle_generation_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtitle_generation_logs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      subtitle_language_options: {
        Row: {
          code: string
          display_order: number | null
          is_african: boolean | null
          label: string
          native_label: string | null
          region: string | null
        }
        Insert: {
          code: string
          display_order?: number | null
          is_african?: boolean | null
          label: string
          native_label?: string | null
          region?: string | null
        }
        Update: {
          code?: string
          display_order?: number | null
          is_african?: boolean | null
          label?: string
          native_label?: string | null
          region?: string | null
        }
        Relationships: []
      }
      subtitle_sync_jobs: {
        Row: {
          completed_at: string | null
          content_types: string[] | null
          created_at: string | null
          created_by: string | null
          current_content_id: string | null
          current_episode_id: string | null
          error_log: Json | null
          failed_items: number | null
          id: string
          languages: string[] | null
          processed_items: number | null
          skipped_items: number | null
          started_at: string | null
          status: string
          successful_items: number | null
          total_items: number | null
        }
        Insert: {
          completed_at?: string | null
          content_types?: string[] | null
          created_at?: string | null
          created_by?: string | null
          current_content_id?: string | null
          current_episode_id?: string | null
          error_log?: Json | null
          failed_items?: number | null
          id?: string
          languages?: string[] | null
          processed_items?: number | null
          skipped_items?: number | null
          started_at?: string | null
          status?: string
          successful_items?: number | null
          total_items?: number | null
        }
        Update: {
          completed_at?: string | null
          content_types?: string[] | null
          created_at?: string | null
          created_by?: string | null
          current_content_id?: string | null
          current_episode_id?: string | null
          error_log?: Json | null
          failed_items?: number | null
          id?: string
          languages?: string[] | null
          processed_items?: number | null
          skipped_items?: number | null
          started_at?: string | null
          status?: string
          successful_items?: number | null
          total_items?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subtitle_sync_jobs_current_content_id_fkey"
            columns: ["current_content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtitle_sync_jobs_current_episode_id_fkey"
            columns: ["current_episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      subtitles: {
        Row: {
          cdn_url: string | null
          content_id: string
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          edited_at: string | null
          edited_by: string | null
          episode_id: string | null
          external_id: string | null
          external_metadata: Json | null
          external_source: string | null
          fetch_attempts: number | null
          id: string
          is_translated: boolean | null
          language_code: string
          language_label: string
          last_fetch_attempt: string | null
          manually_edited: boolean | null
          match_confidence: number | null
          source_subtitle_id: string | null
          source_type: string | null
          speaker_labels: Json | null
          storage_provider: string | null
          subtitle_url: string
          updated_at: string
          word_count: number | null
        }
        Insert: {
          cdn_url?: string | null
          content_id: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          edited_at?: string | null
          edited_by?: string | null
          episode_id?: string | null
          external_id?: string | null
          external_metadata?: Json | null
          external_source?: string | null
          fetch_attempts?: number | null
          id?: string
          is_translated?: boolean | null
          language_code: string
          language_label: string
          last_fetch_attempt?: string | null
          manually_edited?: boolean | null
          match_confidence?: number | null
          source_subtitle_id?: string | null
          source_type?: string | null
          speaker_labels?: Json | null
          storage_provider?: string | null
          subtitle_url: string
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          cdn_url?: string | null
          content_id?: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          edited_at?: string | null
          edited_by?: string | null
          episode_id?: string | null
          external_id?: string | null
          external_metadata?: Json | null
          external_source?: string | null
          fetch_attempts?: number | null
          id?: string
          is_translated?: boolean | null
          language_code?: string
          language_label?: string
          last_fetch_attempt?: string | null
          manually_edited?: boolean | null
          match_confidence?: number | null
          source_subtitle_id?: string | null
          source_type?: string | null
          speaker_labels?: Json | null
          storage_provider?: string | null
          subtitle_url?: string
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subtitles_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtitles_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtitles_source_subtitle_id_fkey"
            columns: ["source_subtitle_id"]
            isOneToOne: false
            referencedRelation: "subtitles"
            referencedColumns: ["id"]
          },
        ]
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
      user_devices: {
        Row: {
          device_id: string
          device_name: string | null
          id: string
          is_active: boolean
          last_active: string
          registered_at: string
          user_id: string
        }
        Insert: {
          device_id: string
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_active?: string
          registered_at?: string
          user_id: string
        }
        Update: {
          device_id?: string
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_active?: string
          registered_at?: string
          user_id?: string
        }
        Relationships: []
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
          require_parent_approval: boolean | null
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
          require_parent_approval?: boolean | null
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
          require_parent_approval?: boolean | null
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
          profile_id: string | null
          progress: number | null
          user_id: string
        }
        Insert: {
          content_id: string
          id?: string
          last_watched?: string | null
          profile_id?: string | null
          progress?: number | null
          user_id: string
        }
        Update: {
          content_id?: string
          id?: string
          last_watched?: string | null
          profile_id?: string | null
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
          {
            foreignKeyName: "watch_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_parties: {
        Row: {
          content_id: string
          created_at: string | null
          episode_id: string | null
          has_started: boolean | null
          host_user_id: string
          id: string
          is_active: boolean | null
          is_playing: boolean | null
          party_code: string
          playback_time: number | null
          updated_at: string | null
        }
        Insert: {
          content_id: string
          created_at?: string | null
          episode_id?: string | null
          has_started?: boolean | null
          host_user_id: string
          id?: string
          is_active?: boolean | null
          is_playing?: boolean | null
          party_code: string
          playback_time?: number | null
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string | null
          episode_id?: string | null
          has_started?: boolean | null
          host_user_id?: string
          id?: string
          is_active?: boolean | null
          is_playing?: boolean | null
          party_code?: string
          playback_time?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_parties_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_parties_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_party_members: {
        Row: {
          id: string
          is_ready: boolean | null
          joined_at: string | null
          party_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_ready?: boolean | null
          joined_at?: string | null
          party_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_ready?: boolean | null
          joined_at?: string | null
          party_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_party_members_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "watch_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_party_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          party_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          party_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          party_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_party_messages_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "watch_parties"
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
          is_kids_friendly: boolean | null
          kids_category_id: string | null
          last_synced_at: string | null
          name: string
          show_on_desktop: boolean | null
          show_on_mobile: boolean | null
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
          is_kids_friendly?: boolean | null
          kids_category_id?: string | null
          last_synced_at?: string | null
          name: string
          show_on_desktop?: boolean | null
          show_on_mobile?: boolean | null
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
          is_kids_friendly?: boolean | null
          kids_category_id?: string | null
          last_synced_at?: string | null
          name?: string
          show_on_desktop?: boolean | null
          show_on_mobile?: boolean | null
          subscriber_count?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_channels_kids_category_id_fkey"
            columns: ["kids_category_id"]
            isOneToOne: false
            referencedRelation: "kids_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_playlists: {
        Row: {
          channel_id: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
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
          last_synced_at?: string | null
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
          last_synced_at?: string | null
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
      creator_profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          display_name: string | null
          follower_count: number | null
          id: string | null
          is_active: boolean | null
          is_verified: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          id?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          id?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles_safe: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_subscribed: boolean | null
          last_login_at: string | null
          mobile_number_masked: string | null
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
          mobile_number_masked?: never
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
          mobile_number_masked?: never
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
      admin_can_access_sensitive_profile_data: {
        Args: { _admin_id: string; _target_user_id: string }
        Returns: boolean
      }
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
      clear_session: { Args: never; Returns: undefined }
      generate_party_code: { Args: never; Returns: string }
      generate_secure_session_id: { Args: never; Returns: string }
      get_content_views_last_30_days: {
        Args: { content_uuid: string }
        Returns: number
      }
      get_creator_kyc_with_logging: {
        Args: {
          p_creator_id: string
          p_ip_address?: string
          p_user_agent?: string
        }
        Returns: {
          address_city: string
          address_country: string
          address_line1: string
          created_at: string
          creator_id: string
          date_of_birth: string
          email: string
          full_name: string
          id: string
          id_document_url: string
          id_expiry_date: string
          id_number: string
          id_type: string
          nationality: string
          phone_number: string
          rejection_reason: string
          reviewed_at: string
          reviewed_by: string
          status: string
          updated_at: string
        }[]
      }
      get_creator_profile: {
        Args: { _user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          id: string
          is_verified: boolean
          pending_balance: number
          total_earnings: number
        }[]
      }
      get_masked_mobile: { Args: { user_uuid: string }; Returns: string }
      get_safe_profile_for_admin: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          country: string
          created_at: string
          display_name: string
          id: string
          is_subscribed: boolean
          last_login_at: string
          mobile_number_masked: string
          parental_controls_enabled: boolean
          parental_rating_limit: string
          subscription_expiry: string
          updated_at: string
        }[]
      }
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
      has_purchased_content: {
        Args: { _content_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_creator: { Args: { _user_id: string }; Returns: boolean }
      is_party_host: {
        Args: { _party_id: string; _user_id: string }
        Returns: boolean
      }
      is_party_member: {
        Args: { _party_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      join_watch_party_by_code: {
        Args: { party_code: string }
        Returns: {
          content_id: string
          episode_id: string
          has_started: boolean
          host_user_id: string
          is_playing: boolean
          party_code_out: string
          party_id: string
          playback_time: number
        }[]
      }
      log_kyc_access: {
        Args: {
          p_action: string
          p_creator_id: string
          p_details?: Json
          p_ip_address?: string
          p_kyc_id: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      reset_pin_secure: {
        Args: { input_secret: string; new_pin: string; user_mobile: string }
        Returns: {
          error_message: string
          success: boolean
        }[]
      }
      update_mobile_number: { Args: { new_mobile: string }; Returns: boolean }
      validate_session: { Args: { session_id: string }; Returns: boolean }
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
      app_role: "admin" | "moderator" | "user" | "super_admin" | "creator"
      lifecycle_status_enum: "active" | "leaving_soon" | "hidden" | "kept"
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
      app_role: ["admin", "moderator", "user", "super_admin", "creator"],
      lifecycle_status_enum: ["active", "leaving_soon", "hidden", "kept"],
    },
  },
} as const
