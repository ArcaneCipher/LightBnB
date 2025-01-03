const properties = require("./json/properties.json");
const users = require("./json/users.json");

const { Pool } = require("pg");

const pool = new Pool({
  user: "development",
  password: "development",
  host: "localhost",
  database: "lightbnb",
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function (email) {
  return pool
    .query(
      `SELECT * FROM users WHERE email = $1;`, // SQL query to find the user by email
      [email] // Use parameterized queries to prevent SQL injection
    )
    .then((result) => {
      if (result.rows.length === 0) {
        return null; // Return null if no user is found
      }
      return result.rows[0]; // Return the first (and only) user found
    })
    .catch((err) => {
      console.log("Error querying database: ", err.message); // Log the error for debugging
      throw err; // Re-throw the error so it can be handled by the caller
    });
};

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function (id) {
  return pool
    .query(`SELECT * FROM users WHERE id = $1;`, // SQL query to find the user by ID
      [id]) // Use parameterized queries to prevent SQL injection
    .then((result) => {
      if (result.rows.length === 0) {
        return null; // Return null if no user is found
      }
      return result.rows[0]; // Return the first (and only) user found
    })
    .catch((err) => {
      console.error("Error querying database:", err.message); // Log the error for debugging
      throw err; // Re-throw the error so it can be handled by the caller
    });
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function (user) {
  const { name, email, password } = user;

  return pool
    .query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING *;`, // Return the newly inserted user
      [name, email, password] // Use parameterized query to safely insert values
    )
    .then((result) => {
      return result.rows[0]; // Return the inserted user object
    })
    .catch((err) => {
      console.error("Error inserting user into database:", err.message); // Log the error
      throw err; // Re-throw the error to propagate it
    });
};

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function (guest_id, limit = 10) {
  return pool
    .query(
      `
      SELECT reservations.id AS reservation_id, 
             reservations.start_date, 
             reservations.end_date, 
             properties.title, 
             properties.cost_per_night,
             properties.cover_photo_url,
             properties.thumbnail_photo_url,
             properties.parking_spaces, 
             properties.number_of_bathrooms,
             properties.number_of_bedrooms,  
             AVG(property_reviews.rating) AS average_rating
      FROM reservations
      JOIN properties ON reservations.property_id = properties.id
      LEFT JOIN property_reviews ON properties.id = property_reviews.property_id
      WHERE reservations.guest_id = $1 AND reservations.end_date < now()::date
      GROUP BY reservations.id, properties.id
      ORDER BY reservations.start_date
      LIMIT $2;
      `,
      [guest_id, limit] // Parameterized query values
    )
    .then((result) => {
      return result.rows; // Return the rows (reservations data)
    })
    .catch((err) => {
      console.error("Error fetching reservations:", err.message); // Log the error
      throw err; // Re-throw the error
    });
};

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = (options, limit = 10) => {
  // Setup an array to hold any parameters that may be available for the query.
  const queryParams = [];

  // Start the query with all information that comes before the WHERE clause.
  let queryString = `
  SELECT properties.*, avg(property_reviews.rating) as average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_id
  `;

  // Initialize WHERE clause logic
  let whereClauses = [];

  // Check if a city is provided.
  if (options.city) {
    queryParams.push(`%${options.city}%`); // Add the city to the params array
    whereClauses.push(`city LIKE $${queryParams.length}`);
  }

  // Check if an owner_id is provided.
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    whereClauses.push(`owner_id = $${queryParams.length}`);
  }

  // Check if a price range is provided.
  if (options.minimum_price_per_night) {
    queryParams.push(Number(options.minimum_price_per_night) * 100); // Convert dollars to cents
    whereClauses.push(`cost_per_night >= $${queryParams.length}`);
  }
  if (options.maximum_price_per_night) {
    queryParams.push(Number(options.maximum_price_per_night) * 100); // Convert dollars to cents
    whereClauses.push(`cost_per_night <= $${queryParams.length}`);
  }

  // Add the WHERE clause to the query string if there are conditions.
  if (whereClauses.length > 0) {
    queryString += `WHERE ${whereClauses.join(' AND ')} `;
  }

  // Add grouping logic.
  queryString += `
  GROUP BY properties.id
  `;

  // The HAVING clause should only be included if options.minimum_rating is explicitly provided.
  if (options.minimum_rating) {
    queryString += `HAVING avg(property_reviews.rating) >= $${queryParams.push(
      options.minimum_rating
    )} `;
  }

  // Add ordering and limiting logic.
  queryString += `
  ORDER BY cost_per_night
  LIMIT $${queryParams.push(limit)};
  `;

  console.log(queryString, queryParams); // Log the query string and parameters for debugging.

  // Execute the query and return the results.
  return pool.query(queryString, queryParams).then((res) => res.rows);
};


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function (property) {
  const queryParams = [
    property.owner_id,
    property.title,
    property.description,
    property.thumbnail_photo_url,
    property.cover_photo_url,
    Number(property.cost_per_night) * 100, // Convert to cents
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms,
  ];

  const queryString = `
    INSERT INTO properties (
      owner_id, 
      title, 
      description, 
      thumbnail_photo_url, 
      cover_photo_url, 
      cost_per_night, 
      street, 
      city, 
      province, 
      post_code, 
      country, 
      parking_spaces, 
      number_of_bathrooms, 
      number_of_bedrooms
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    RETURNING *;
  `;

  return pool
    .query(queryString, queryParams)
    .then((result) => result.rows[0]) // Return the inserted property
    .catch((err) => {
      console.error("Error inserting property into database:", err.message);
      throw err; // Re-throw the error to propagate it
    });
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
