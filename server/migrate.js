const { pool } = require('./db');

async function migrate() {
  console.log('Running database migrations...');
  try {
    await pool.query(`
      ALTER TABLE devices 
      ADD COLUMN IF NOT EXISTS driver_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS vehicle_year INTEGER;
    `);
    console.log('Migration successful: Added driver_name, driver_phone, vehicle_year to devices table.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrate();
