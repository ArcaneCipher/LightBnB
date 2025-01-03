const { Pool } = require("pg");

const pool = new Pool({
  user: "development",
  password: "development",
  host: "localhost",
  database: "lightbnb",
  port: 5432,
});

pool.query("SELECT NOW()")
  .then((res) => {
    console.log("Database connection successful:", res.rows[0]);
    pool.end();
  })
  .catch((err) => {
    console.error("Database connection error:", err.message);
  });
