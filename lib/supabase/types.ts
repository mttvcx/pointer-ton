/**
 * Pointer database types - hand-authored from the Phase 1 schema in
 * PHASE-1-PROMPT.md. This file is the typed source of truth for every
 * `lib/db/*.ts` wrapper.
 *
 * MIGRATION NOTE
 * --------------
 * Once `supabase login` succeeds locally, `npm run gen:types` will overwrite
 * this file with the generator's output. Until then we maintain it manually -
 * the only mismatch risk is column nullability, which I've kept conservative
 * (most columns nullable) so reads never throw on missing data.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ----------------------------- enum helpers ----------------------------- */

export type TradeSide = 'buy' | 'sell';
export type TradeStatus = 'pending' | 'confirmed' | 'failed';

/* -------------------------------- tables -------------------------------- */

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          privy_id: string;
          wallet_address: string | null;
          username: string | null;
          email: string | null;
          ai_quota_used_today: number;
          ai_quota_reset_at: string;
          tier_id: string;
          created_at: string;
          onboarding_completed_at: string | null;
          onboarding_step: number;
          beta_granted_at: string | null;
          starter_trackers_seeded_at: string | null;
        };
        Insert: {
          id?: string;
          privy_id: string;
          wallet_address?: string | null;
          username?: string | null;
          email?: string | null;
          ai_quota_used_today?: number;
          ai_quota_reset_at?: string;
          tier_id?: string;
          created_at?: string;
          onboarding_completed_at?: string | null;
          onboarding_step?: number;
          beta_granted_at?: string | null;
          starter_trackers_seeded_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };

      user_tiers: {
        Row: {
          id: string;
          name: string;
          fee_bps: number;
          ai_quota_usd_daily: number;
          point_multiplier: number;
        };
        Insert: {
          id: string;
          name: string;
          fee_bps: number;
          ai_quota_usd_daily: number;
          point_multiplier: number;
        };
        Update: Partial<Database['public']['Tables']['user_tiers']['Insert']>;
        Relationships: [];
      };

      user_points: {
        Row: {
          id: string;
          user_id: string;
          source: string;
          amount: number;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: string;
          amount: number;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_points']['Insert']>;
        Relationships: [];
      };

      tokens: {
        Row: {
          mint: string;
          symbol: string | null;
          name: string | null;
          decimals: number;
          image_url: string | null;
          description: string | null;
          twitter_handle: string | null;
          telegram_url: string | null;
          website_url: string | null;
          creator_wallet: string | null;
          launch_pad: string | null;
          raw_metadata: Json | null;
          initial_liquidity_sol: number | null;
          initial_liquidity_at: string | null;
          migrated_at: string | null;
          migrated_to: string | null;
          bonding_progress: number | null;
          mint_authority: string | null;
          freeze_authority: string | null;
          is_lp_locked: boolean | null;
          is_paid: boolean | null;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          mint: string;
          symbol?: string | null;
          name?: string | null;
          decimals?: number;
          image_url?: string | null;
          description?: string | null;
          twitter_handle?: string | null;
          telegram_url?: string | null;
          website_url?: string | null;
          creator_wallet?: string | null;
          launch_pad?: string | null;
          raw_metadata?: Json | null;
          initial_liquidity_sol?: number | null;
          initial_liquidity_at?: string | null;
          migrated_at?: string | null;
          migrated_to?: string | null;
          bonding_progress?: number | null;
          mint_authority?: string | null;
          freeze_authority?: string | null;
          is_lp_locked?: boolean | null;
          is_paid?: boolean | null;
          created_at?: string;
          last_seen_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tokens']['Insert']>;
        Relationships: [];
      };

      token_market_snapshots: {
        Row: {
          id: number;
          mint: string;
          market_cap_usd: number | null;
          liquidity_usd: number | null;
          price_usd: number | null;
          volume_5m_usd: number | null;
          volume_1h_usd: number | null;
          volume_24h_usd: number | null;
          txns_5m: number | null;
          txns_1h: number | null;
          holder_count: number | null;
          top10_holder_pct: number | null;
          dev_holding_pct: number | null;
          extended_metrics: Json | null;
          snapshot_at: string;
        };
        Insert: {
          id?: number;
          mint: string;
          market_cap_usd?: number | null;
          liquidity_usd?: number | null;
          price_usd?: number | null;
          volume_5m_usd?: number | null;
          volume_1h_usd?: number | null;
          volume_24h_usd?: number | null;
          txns_5m?: number | null;
          txns_1h?: number | null;
          holder_count?: number | null;
          top10_holder_pct?: number | null;
          dev_holding_pct?: number | null;
          extended_metrics?: Json | null;
          snapshot_at?: string;
        };
        Update: Partial<Database['public']['Tables']['token_market_snapshots']['Insert']>;
        Relationships: [];
      };

      token_embeddings: {
        Row: {
          mint: string;
          embedding: number[] | null;
          embedded_text: string | null;
          created_at: string;
        };
        Insert: {
          mint: string;
          embedding?: number[] | null;
          embedded_text?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['token_embeddings']['Insert']>;
        Relationships: [];
      };

      token_holders: {
        Row: {
          id: number;
          mint: string;
          wallet_address: string;
          amount_raw: string;
          pct_of_supply: number | null;
          is_dev: boolean | null;
          is_sniper: boolean | null;
          rank: number | null;
          computed_at: string;
        };
        Insert: {
          id?: number;
          mint: string;
          wallet_address: string;
          amount_raw: string;
          pct_of_supply?: number | null;
          is_dev?: boolean | null;
          is_sniper?: boolean | null;
          rank?: number | null;
          computed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['token_holders']['Insert']>;
        Relationships: [];
      };

      trades: {
        Row: {
          id: string;
          user_id: string;
          mint: string;
          side: TradeSide;
          amount_in_raw: string;
          amount_out_raw: string;
          amount_sol: number | null;
          amount_token: number | null;
          price_usd_at_fill: number | null;
          tx_signature: string;
          fee_paid_lamports: number | null;
          platform_fee_lamports: number | null;
          priority_fee_lamports: number | null;
          jito_tip_lamports: number | null;
          status: TradeStatus;
          failure_reason: string | null;
          submitted_at: string;
          confirmed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          mint: string;
          side: TradeSide;
          amount_in_raw: string;
          amount_out_raw: string;
          amount_sol?: number | null;
          amount_token?: number | null;
          price_usd_at_fill?: number | null;
          tx_signature: string;
          fee_paid_lamports?: number | null;
          platform_fee_lamports?: number | null;
          priority_fee_lamports?: number | null;
          jito_tip_lamports?: number | null;
          status?: TradeStatus;
          failure_reason?: string | null;
          submitted_at?: string;
          confirmed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['trades']['Insert']>;
        Relationships: [];
      };

      trading_presets: {
        Row: {
          id: string;
          user_id: string;
          slot: number;
          name: string | null;
          buy_amounts_sol: number[] | null;
          slippage_bps: number;
          dynamic_slippage: boolean;
          priority_fee_lamports: number;
          mev_mode: string;
          jito_tip_lamports: number;
          auto_fee: boolean;
          max_fee_sol: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          slot: number;
          name?: string | null;
          buy_amounts_sol?: number[] | null;
          slippage_bps?: number;
          dynamic_slippage?: boolean;
          priority_fee_lamports?: number;
          mev_mode?: string;
          jito_tip_lamports?: number;
          auto_fee?: boolean;
          max_fee_sol?: number | null;
        };
        Update: Partial<Database['public']['Tables']['trading_presets']['Insert']>;
        Relationships: [];
      };

      column_presets: {
        Row: {
          id: string;
          user_id: string;
          column_id: string;
          preset_slot: number;
          name: string | null;
          filters: Json;
          display_options: Json;
          sort_by: string;
          sort_dir: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          column_id: string;
          preset_slot: number;
          name?: string | null;
          filters?: Json;
          display_options?: Json;
          sort_by?: string;
          sort_dir?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['column_presets']['Insert']>;
        Relationships: [];
      };

      user_wallets: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          wallet_address: string;
          is_primary: boolean;
          slot: number;
          is_archived: boolean;
          is_active: boolean;
          is_imported: boolean;
          balance_lamports: number | string | null;
          balance_updated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          wallet_address: string;
          is_primary?: boolean;
          slot?: number;
          is_archived?: boolean;
          is_active?: boolean;
          is_imported?: boolean;
          balance_lamports?: number | string | null;
          balance_updated_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_wallets']['Insert']>;
        Relationships: [];
      };

      wallet_labels: {
        Row: {
          id: string;
          user_id: string;
          wallet_address: string;
          label: string;
          emoji: string | null;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          wallet_address: string;
          label: string;
          emoji?: string | null;
          color?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['wallet_labels']['Insert']>;
        Relationships: [];
      };

      twitter_ingest_tweets: {
        Row: {
          tweet_id: string;
          author_handle: string;
          text: string;
          image_urls: string[];
          image_hashes: Json;
          tweet_kind: string | null;
          tweet_url: string | null;
          raw_json: Json | null;
          received_at: string;
        };
        Insert: {
          tweet_id: string;
          author_handle: string;
          text?: string;
          image_urls?: string[];
          image_hashes?: Json;
          tweet_kind?: string | null;
          tweet_url?: string | null;
          raw_json?: Json | null;
          received_at?: string;
        };
        Update: Partial<Database['public']['Tables']['twitter_ingest_tweets']['Insert']>;
        Relationships: [];
      };

      alert_rules: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          rule_type: string;
          rule_config: Json;
          trigger_type: string | null;
          trigger_config: Json;
          action_type: string | null;
          action_config: Json;
          activity_filter: Json;
          disable_after_success: boolean;
          cooldown_seconds: number;
          daily_cap_sol: number | null;
          flash_enabled: boolean;
          flash_color: string;
          flash_size: string;
          audio_enabled: boolean;
          audio_url: string | null;
          audio_preset: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          rule_type: string;
          rule_config: Json;
          trigger_type?: string | null;
          trigger_config?: Json;
          action_type?: string | null;
          action_config?: Json;
          activity_filter?: Json;
          disable_after_success?: boolean;
          cooldown_seconds?: number;
          daily_cap_sol?: number | null;
          flash_enabled?: boolean;
          flash_color?: string;
          flash_size?: string;
          audio_enabled?: boolean;
          audio_url?: string | null;
          audio_preset?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['alert_rules']['Insert']>;
        Relationships: [];
      };

      pnl_cards: {
        Row: {
          id: string;
          user_id: string;
          trade_id: string;
          background_type: string;
          background_preset: string | null;
          background_url: string | null;
          card_data: Json;
          share_token: string;
          view_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          trade_id: string;
          background_type?: string;
          background_preset?: string | null;
          background_url?: string | null;
          card_data: Json;
          share_token: string;
          view_count?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['pnl_cards']['Insert']>;
        Relationships: [];
      };

      limit_orders: {
        Row: {
          id: string;
          user_id: string;
          mint: string;
          side: TradeSide;
          trigger_price_usd: number;
          amount_sol: number | null;
          amount_token_pct: number | null;
          slippage_bps: number;
          status: string;
          expires_at: string | null;
          triggered_at: string | null;
          trigger_price_usd_at_fire: number | null;
          filled_tx_signature: string | null;
          filled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mint: string;
          side: TradeSide;
          trigger_price_usd: number;
          amount_sol?: number | null;
          amount_token_pct?: number | null;
          slippage_bps?: number;
          status?: string;
          expires_at?: string | null;
          triggered_at?: string | null;
          trigger_price_usd_at_fire?: number | null;
          filled_tx_signature?: string | null;
          filled_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['limit_orders']['Insert']>;
        Relationships: [];
      };

      tracked_wallets: {
        Row: {
          id: string;
          user_id: string;
          wallet_address: string;
          label: string | null;
          notify: boolean;
          group_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          wallet_address: string;
          label?: string | null;
          notify?: boolean;
          group_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tracked_wallets']['Insert']>;
        Relationships: [];
      };

      tracker_groups: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          app_chain: string;
          is_starter: boolean;
          slug: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          app_chain: string;
          is_starter?: boolean;
          slug?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tracker_groups']['Insert']>;
        Relationships: [];
      };

      tracker_rules: {
        Row: {
          id: string;
          user_id: string;
          tracked_wallet_id: string;
          nl_text: string;
          condition: Json;
          summary: string;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tracked_wallet_id: string;
          nl_text: string;
          condition: Json;
          summary: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tracker_rules']['Insert']>;
        Relationships: [];
      };

      wallet_stats: {
        Row: {
          wallet_address: string;
          pnl_usd_30d: number | null;
          pnl_usd_7d: number | null;
          pnl_usd_24h: number | null;
          win_rate_30d: number | null;
          trades_30d: number | null;
          best_trade_multiple: number | null;
          avg_hold_seconds: number | null;
          total_volume_30d_usd: number | null;
          is_kol: boolean | null;
          kol_handle: string | null;
          computed_at: string;
        };
        Insert: {
          wallet_address: string;
          pnl_usd_30d?: number | null;
          pnl_usd_7d?: number | null;
          pnl_usd_24h?: number | null;
          win_rate_30d?: number | null;
          trades_30d?: number | null;
          best_trade_multiple?: number | null;
          avg_hold_seconds?: number | null;
          total_volume_30d_usd?: number | null;
          is_kol?: boolean | null;
          kol_handle?: string | null;
          computed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['wallet_stats']['Insert']>;
        Relationships: [];
      };

      dev_wallet_stats: {
        Row: {
          wallet_address: string;
          tokens_launched: number;
          tokens_mooned: number;
          tokens_rugged: number;
          tokens_active: number;
          total_volume_generated_usd: number | null;
          reputation_score: number | null;
          median_time_to_rug_seconds: number | null;
          last_launch_at: string | null;
          computed_at: string;
        };
        Insert: {
          wallet_address: string;
          tokens_launched?: number;
          tokens_mooned?: number;
          tokens_rugged?: number;
          tokens_active?: number;
          total_volume_generated_usd?: number | null;
          reputation_score?: number | null;
          median_time_to_rug_seconds?: number | null;
          last_launch_at?: string | null;
          computed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['dev_wallet_stats']['Insert']>;
        Relationships: [];
      };

      ai_responses: {
        Row: {
          id: string;
          cache_key: string;
          pipeline: string;
          input_hash: string;
          user_id: string | null;
          response: Json;
          model_used: string;
          cost_usd: number;
          cache_hit: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          cache_key: string;
          pipeline: string;
          input_hash: string;
          user_id?: string | null;
          response: Json;
          model_used: string;
          cost_usd: number;
          cache_hit?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['ai_responses']['Insert']>;
        Relationships: [];
      };

      social_mentions: {
        Row: {
          id: string;
          mint: string;
          source: string;
          author_handle: string | null;
          author_followers: number | null;
          author_verified: boolean | null;
          content: string | null;
          url: string | null;
          posted_at: string | null;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          mint: string;
          source?: string;
          author_handle?: string | null;
          author_followers?: number | null;
          author_verified?: boolean | null;
          content?: string | null;
          url?: string | null;
          posted_at?: string | null;
          fetched_at?: string;
        };
        Update: Partial<Database['public']['Tables']['social_mentions']['Insert']>;
        Relationships: [];
      };

      alerts: {
        Row: {
          id: string;
          user_id: string | null;
          type: string;
          payload: Json;
          ai_narration: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          type: string;
          payload: Json;
          ai_narration?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['alerts']['Insert']>;
        Relationships: [];
      };

      webhook_events: {
        Row: {
          signature: string;
          source: string;
          payload: Json;
          processed_at: string;
        };
        Insert: {
          signature: string;
          source: string;
          payload: Json;
          processed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['webhook_events']['Insert']>;
        Relationships: [];
      };

      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string;
          code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referred_id: string;
          code: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['referrals']['Insert']>;
        Relationships: [];
      };

      referral_codes: {
        Row: {
          code: string;
          user_id: string;
          is_active: boolean;
          uses_count: number;
          created_at: string;
        };
        Insert: {
          code: string;
          user_id: string;
          is_active?: boolean;
          uses_count?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['referral_codes']['Insert']>;
        Relationships: [];
      };

      referral_earnings: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string;
          trade_id: string;
          amount_lamports: number;
          paid_out: boolean;
          paid_out_tx_signature: string | null;
          paid_out_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referred_id: string;
          trade_id: string;
          amount_lamports: number;
          paid_out?: boolean;
          paid_out_tx_signature?: string | null;
          paid_out_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['referral_earnings']['Insert']>;
        Relationships: [];
      };

      points_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          base_points: number;
          multiplier: number;
          final_points: number;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          base_points: number;
          multiplier?: number;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['points_events']['Insert']>;
        Relationships: [];
      };

      announcements: {
        Row: {
          id: string;
          slug: string;
          headline: string;
          description: string;
          video_url: string | null;
          show_from: string;
          show_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          headline: string;
          description: string;
          video_url?: string | null;
          show_from: string;
          show_until?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>;
        Relationships: [];
      };

      beta_codes: {
        Row: {
          id: string;
          code_hash: string;
          created_by_user_id: string;
          used_by_user_id: string | null;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code_hash: string;
          created_by_user_id: string;
          used_by_user_id?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['beta_codes']['Insert']>;
        Relationships: [];
      };

      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Insert']>;
        Relationships: [];
      };

      user_announcement_dismissals: {
        Row: {
          id: string;
          user_id: string;
          announcement_id: string;
          dismissed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          announcement_id: string;
          dismissed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_announcement_dismissals']['Insert']>;
        Relationships: [];
      };
    };

    Views: {
      points_leaderboard: {
        Row: {
          user_id: string;
          username: string | null;
          wallet_address: string | null;
          total_points: number;
          active_days: number;
          rank: number;
        };
        Relationships: [];
      };
    };

    Functions: {
      refresh_points_leaderboard: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/* ------------------------------ row helpers ----------------------------- */

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
