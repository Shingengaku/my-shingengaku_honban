const { readFileSync } = require('fs');
const { parse } = require('dotenv');
const path = require('path');
const { Client } = require('pg');

const envConfig = parse(readFileSync(path.resolve(process.cwd(), '.env.local')));
const connectionString = envConfig.DATABASE_URL;

async function run() {
    if (!connectionString) {
        console.error("No DATABASE_URL found");
        return;
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 既にカラムが存在するかチェック
        const checkColumnQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'applications' 
              AND column_name = 'parent_application_id';
        `;
        const colRes = await client.query(checkColumnQuery);
        if (colRes.rows.length > 0) {
            console.log("Column 'parent_application_id' already exists in applications table.");
            return;
        }

        console.log("Adding 'parent_application_id' column to applications table...");
        
        // カラム追加
        await client.query(`
            ALTER TABLE public.applications 
            ADD COLUMN parent_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL;
        `);
        console.log("Column added successfully!");

        // インデックス作成
        console.log("Creating index idx_applications_parent_application_id...");
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_applications_parent_application_id 
            ON public.applications(parent_application_id);
        `);
        console.log("Index created successfully!");

        console.log("Migration completed successfully!");

    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await client.end();
    }
}
run();
