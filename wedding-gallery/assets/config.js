/* PALM & TOEY · Wedding Gallery — public configuration.
   These two values are PUBLIC by design (anon/publishable key, protected by RLS).
   NEVER put the service_role / secret key in any frontend file. */
window.WG_CONFIG = {
  SUPABASE_URL: 'https://ebbnmgngfufrdjkkmhnx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViYm5tZ25nZnVmcmRqa2ttaG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU3NDgxNzQsImV4cCI6MjExMTMyNDE3NH0.N3DlVZtI_hsh94qHQCJ4CieLeZMEUAwuAvcAP1vQsog',
  BUCKET: 'wedding-photos',
  TABLE: 'wedding_photos',
  MAX_FILES_PER_BATCH: 30,
  MAX_INPUT_MB: 40,          // original file from phone (before compression)
  FULL_MAX_EDGE: 2048,       // px, long edge of the stored photo
  FULL_QUALITY: 0.85,
  THUMB_MAX_EDGE: 640,       // px, long edge of the gallery thumbnail
  THUMB_QUALITY: 0.76,
  PAGE_SIZE: 24
};
