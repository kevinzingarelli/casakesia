import { createClient } from '@supabase/supabase-js';

// Questi valori sono pubblici per design (chiave "publishable" + RLS attiva sulla tabella)
const SUPABASE_URL = 'https://qtocmomtqsazerqikjrc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H9m9tPwK7vC3116wU9SPKg_42ODMYul';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const DATA_ROW_ID = 'main';
export const TABLE = 'household_data';
