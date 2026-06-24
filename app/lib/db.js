import mysql from "mysql2/promise";

export const db = mysql.createPool({
    host: process.env.MYSQL_ONLINE === 'true'
        ? process.env.MYSQL_HOST
        : process.env.MYSQL_HOST_LOCAL,
    port: process.env.MYSQL_ONLINE === 'true'
        ? Number(process.env.MYSQL_PORT)
        : 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
})