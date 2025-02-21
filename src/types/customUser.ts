import { User } from '@supabase/supabase-js';

export interface CustomUser extends User {
  photoURL?: string; // Optional property for user photo URL
}
