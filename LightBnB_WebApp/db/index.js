const { Pool } = require("pg");

// Configure the database connection
const pool = new Pool({
  user: "development",
  password: "development",
  host: "localhost",
  database: "lightbnb",
  port: 5432, // Correct PostgreSQL port
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 60000, // Close idle connections after 60 seconds
});

// Centralized query function
const query = async (text, params) => {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("executed query", { text, duration, rows: res.rowCount }); // Logs the query for debugging
    return res;
  } catch (err) {
    console.error("Query error", { text, params, error: err.message }); // Log query details and error
    throw err; // Re-throw the error to propagate it
  }
};

// Handle pool errors globally
pool.on("error", (err) => {
  console.error("Unexpected error on idle client:", err.message);
  process.exit(-1); // Exit the process if a critical error occurs
});

// Graceful shutdown on process termination
process.on("SIGINT", async () => {
  console.log("Closing database connection pool...");
  await pool.end();
  process.exit(0);
});

module.exports = {
  query, // Export the query function
};
