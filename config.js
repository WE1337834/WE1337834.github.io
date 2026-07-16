// config.js

const SUPABASE_URL = 'https://olqcbsltlgjythieykzw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWNic2x0bGdqeXRoaWV5a3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDczODUsImV4cCI6MjA5OTc4MzM4NX0.oaw5ow2eARBwnH_GUmQ6fNm62VJa8_ocVX9Shrr78uU';

const SITE_CONFIG = {
    name: 'Developer Portfolio',
    url: 'https://we1337834.github.io/'
};

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getSessionId() {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
}