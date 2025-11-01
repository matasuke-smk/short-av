import { createClient } from '@supabase/supabase-js';

// Supabase接続情報を環境変数から取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabaseクライアントを作成
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// データベース型定義（後で拡張）
export type Database = {
  public: {
    Tables: {
      videos: {
        Row: {
          id: string;
          dmm_content_id: string;
          title: string;
          description: string | null;
          thumbnail_url: string;
          sample_video_url: string | null;
          dmm_product_url: string;
          price: number | null;
          release_date: string | null;
          duration: number | null;
          maker: string | null;
          label: string | null;
          series: string | null;
          genre_ids: string[] | null;
          actress_ids: string[] | null;
          view_count: number;
          click_count: number;
          likes_count: number;
          rank_position: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['videos']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['videos']['Insert']>;
      };
      likes: {
        Row: {
          id: string;
          video_id: string;
          user_identifier: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['likes']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['likes']['Insert']>;
      };
      articles: {
        Row: {
          id: string;
          slug: string;
          title: string;
          meta_description: string;
          content: string;
          video_id: string | null;
          related_video_ids: string[] | null;
          keywords: string[] | null;
          author: string;
          view_count: number;
          is_published: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['articles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['articles']['Insert']>;
      };
      genres: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          parent_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['genres']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['genres']['Insert']>;
      };
      actresses: {
        Row: {
          id: string;
          name: string;
          slug: string;
          kana: string | null;
          profile_image_url: string | null;
          birth_date: string | null;
          height: number | null;
          bust: number | null;
          waist: number | null;
          hip: number | null;
          blood_type: string | null;
          bio: string | null;
          video_count: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['actresses']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['actresses']['Insert']>;
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['settings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['settings']['Insert']>;
      };
    };
  };
};
