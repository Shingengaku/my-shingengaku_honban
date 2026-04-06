require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function migrateOnlineVenues() {
    console.log('Connecting to postgres...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    
    try {
        await client.connect();
        
        console.log('Fetching existing online applications...');
        const { rows } = await client.query(`SELECT id, remarks FROM applications WHERE participation_type = 'online'`);
        
        console.log(`Found ${rows.length} online applications.`);

        let updatedCount = 0;

        for (const app of rows) {
            let onlineVenues = null;
            let newRemarks = app.remarks;

            if (app.remarks) {
                const match = /【LIVE視聴会場】\s*([^\n]+)/.exec(app.remarks);
                if (match) {
                    onlineVenues = match[1].trim();
                    newRemarks = app.remarks.replace(/【LIVE視聴会場】\s*[^\n]+/, '').trim();
                    if (newRemarks === '') newRemarks = null;
                }
            }

            console.log(`App ID: ${app.id}, Online Venues: ${onlineVenues}`);
            
            await client.query(
                `UPDATE applications SET online_venues = $1, remarks = $2 WHERE id = $3`,
                [onlineVenues, newRemarks, app.id]
            );
            
            updatedCount++;
        }

        console.log(`Migration complete! Successfully updated ${updatedCount} records.`);
    } catch (e) {
        console.error('Error during migration:', e);
    } finally {
        await client.end();
    }
}

migrateOnlineVenues();
