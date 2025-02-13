export interface Database {
  public: {
    Tables: {
      executions: {
        Row: {
          id: number;
          date: string;
          time: string;
          radio_name: string;
          artist: string;
          song_title: string;
          isrc: string;
          city: string;
          state: string;
          genre: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          date: string;
          time: string;
          radio_name: string;
          artist: string;
          song_title: string;
          isrc: string;
          city: string;
          state: string;
          genre: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          date?: string;
          time?: string;
          radio_name?: string;
          artist?: string;
          song_title?: string;
          isrc?: string;
          city?: string;
          state?: string;
          genre?: string;
          created_at?: string;
        };
      };
    };
  };
}