const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function migrate() {
  console.log('Running database setup/migrations for MySQL...');
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the SQL file by semicolons to execute queries one by one
    const queries = sql.split(';').filter(q => q.trim() !== '');

    for (let query of queries) {
      if (query.trim().length > 0) {
        await pool.query(query);
      }
    }
    console.log('Migration successful: MySQL tables are ready.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrate();
