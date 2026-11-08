import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const configured = Boolean(url && publishableKey && url.startsWith('https://'));
export const supabase = createClient(
  configured ? url : 'https://example.supabase.co',
  configured ? publishableKey : 'missing-publishable-key',
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);
