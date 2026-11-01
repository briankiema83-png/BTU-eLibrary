const SUPABASE_URL = "https://gdwkkqxovulsjsmncwkz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_xXqj8riR6dLA2cLx0Whq-A_0mGSU9PZ";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);
console.log("Supabase client created:", typeof window.supabaseClient);
