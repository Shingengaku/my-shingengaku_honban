
const { createClient } = require('@supabase/supabase-js');

const URL = "https://denudyfitlmigrbxszad.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbnVkeWZpdGxtaWdyYnhzemFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAyNDAxOCwiZXhwIjoyMDgzNjAwMDE4fQ.cotF_fp5eVxyscq6-ZbF0Tr12q3mN3P0r5cJBgLVP5M";

const supabase = createClient(URL, KEY);

async function checkVenues() {
    const { data, error } = await supabase.from('venues').select('*');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

checkVenues();
