const { createClient } = require('@supabase/supabase-js');
try {
  console.log('Testing createClient(undefined, undefined)...');
  createClient(undefined, undefined);
  console.log('Success (no throw)');
} catch (e) {
  console.log('Failed (threw error):', e.message);
}
