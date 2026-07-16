// config.js
const SUPABASE_URL = 'https://olqcbsltlgjythieykzw.supabase.co'; // Вставьте свой URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWNic2x0bGdqeXRoaWV5a3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDczODUsImV4cCI6MjA5OTc4MzM4NX0.oaw5ow2eARBwnH_GUmQ6fNm62VJa8_ocVX9Shrr78uU'; // Вставьте свой anon-ключ

// Инициализация Supabase клиента
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);