import { readFileSync } from 'fs';

// Read from .env.local
const lines = readFileSync('.env.local', 'utf-8').split('\n');
let supabaseUrl = '';
let supabaseServiceKey = '';

for (const line of lines) {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
      supabaseUrl = val;
    }
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
      supabaseServiceKey = val;
    }
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables.");
  process.exit(1);
}

async function run() {
  console.log("Supabase URL:", supabaseUrl);
  // Fetch existing role_permissions
  const res = await fetch(`${supabaseUrl}/rest/v1/role_permissions`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });

  if (!res.ok) {
    console.error("Error reading permissions:", await res.text());
    return;
  }

  const data = await res.json();
  console.log("Current permissions:", data);

  for (const row of data) {
    let changed = false;
    const tabs = row.allowed_tabs || [];
    
    // Add /afiacao to admin, pcm, gestao, mecanico
    if (['admin', 'pcm', 'gestao', 'mecanico'].includes(row.role)) {
      if (!tabs.includes('/afiacao')) {
        tabs.push('/afiacao');
        changed = true;
      }
    }

    if (changed) {
      console.log(`Updating ${row.role} to`, tabs);
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/role_permissions?role=eq.${row.role}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ allowed_tabs: tabs })
      });

      if (!updateRes.ok) {
        console.error(`Error updating ${row.role}:`, await updateRes.text());
      } else {
        console.log(`Successfully updated ${row.role}`);
      }
    }
  }
  console.log("Finished successfully!");
}

run();
