import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jfblprhyqelstnyqgwjn.supabase.co';
const publishableKey = 'sb_publishable_qJLUtASViyVueEb4laLDKA_xszDiz4W';

export const configured = true;

export const supabase = createClient(url, publishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
