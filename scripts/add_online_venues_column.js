require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function addColumn() {
    console.log('Connecting to postgres...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    
    try {
        await client.connect();
        
        console.log('Adding column online_venues...');
        await client.query(`
            ALTER TABLE applications
            ADD COLUMN IF NOT EXISTS online_venues TEXT;
        `);
        console.log('Column added successfully.');
    } catch (e) {
        console.error('Error adding column:', e);
    } finally {
        await client.end();
    }
}

addColumn();
