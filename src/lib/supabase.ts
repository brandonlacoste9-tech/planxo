import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vebwxcezwrrbirsiyyur.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlYnd4Y2V6d3JyYmlyc2l5eXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQxNjA0MywiZXhwIjoyMDk0OTkyMDQzfQ._blAHQhZWhGCyqLCP4Bk62s4dVejDsAsnN3en6BkBd8";

export const supabase = createClient(supabaseUrl, supabaseKey);
