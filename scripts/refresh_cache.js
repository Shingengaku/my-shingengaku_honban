require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function refreshCache() {
    console.log('Connecting to postgres...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    
    try {
        await client.connect();
        
        console.log('Refreshing cache...');
        await client.query(`NOTIFY pgrst, 'reload schema';`);
        console.log('Cache refreshed.');
    } catch (e) {
        console.error('Error refreshing cache:', e);
    } finally {
        await client.end();
    }
}

refreshCache();
