// Tipos básicos para o banco de dados Supabase
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          created_at?: string
          email: string
          name?: string | null
          status: 'TRIAL' | 'ATIVO' | 'INATIVO' | 'ADMIN'
          updated_at?: string
        }
        Insert: {
          id?: string
          created_at?: string
          email: string
          name?: string | null
          status?: 'TRIAL' | 'ATIVO' | 'INATIVO' | 'ADMIN'
          updated_at?: string
        }
        Update: {
          id?: string
          created_at?: string
          email?: string
          name?: string | null
          status?: 'TRIAL' | 'ATIVO' | 'INATIVO' | 'ADMIN'
          updated_at?: string
        }
      }
      // Adicione outras tabelas conforme necessário
    }
  }
} 