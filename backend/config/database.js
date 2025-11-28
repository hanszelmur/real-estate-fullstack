/**
 * Database Configuration
 * 
 * This module sets up the MySQL connection pool using credentials from environment variables.
 * It provides a connection pool for efficient database access throughout the application.
 * 
 * Environment Variables Required:
 * - DB_HOST: MySQL server hostname (default: localhost)
 * - DB_USER: MySQL username (default: root)
 * - DB_PASSWORD: MySQL password
 * - DB_NAME: Database name (default: real_estate_db)
 * - DB_PORT: MySQL port (default: 3306)
 */

const mysql = require('mysql');

// Create a connection pool for better performance and connection management
const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'real_estate_db',
    port: process.env.DB_PORT || 3306,
    // Enable multiple statements for complex queries
    multipleStatements: false,
    // Timezone configuration
    timezone: 'UTC',
    // Connection timeout
    connectTimeout: 10000
});

/**
 * Execute a SQL query with parameters
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array} params - Array of parameter values
 * @returns {Promise} - Resolves with query results
 */
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (error, results) => {
            if (error) {
                console.error('Database query error:', error.message);
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
};

/**
 * Get a connection from the pool for transactions
 * @returns {Promise} - Resolves with a connection object
 */
const getConnection = () => {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error('Database connection error:', error.message);
                reject(error);
            } else {
                resolve(connection);
            }
        });
    });
};

/**
 * Test the database connection
 * @returns {Promise} - Resolves if connection is successful
 */
const testConnection = () => {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error('Failed to connect to database:', error.message);
                reject(error);
            } else {
                console.log('✓ Database connection established successfully');
                connection.release();
                resolve(true);
            }
        });
    });
};

/**
 * Close all connections in the pool
 * @returns {Promise} - Resolves when pool is closed
 */
const closePool = () => {
    return new Promise((resolve, reject) => {
        pool.end((error) => {
            if (error) {
                reject(error);
            } else {
                console.log('Database pool closed');
                resolve();
            }
        });
    });
};

module.exports = {
    pool,
    query,
    getConnection,
    testConnection,
    closePool
};
