import 'dotenv/config'
import mysql from 'mysql2/promise'

function createPool() {
    return mysql.createPool({
        host:
            process.env.MYSQL_ONLINE === 'true'
                ? process.env.MYSQL_HOST
                : process.env.MYSQL_HOST_LOCAL,
        port:
            process.env.MYSQL_ONLINE === 'true'
                ? Number(process.env.MYSQL_PORT)
                : 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
    })
}

async function hasColumn(connection, tableName, columnName) {
    const [rows] = await connection.execute(
        `
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
        LIMIT 1
        `,
        [tableName, columnName]
    )

    return rows.length > 0
}

async function hasIndex(connection, tableName, indexName) {
    const [rows] = await connection.execute(
        `
        SELECT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
        LIMIT 1
        `,
        [tableName, indexName]
    )

    return rows.length > 0
}

async function main() {
    const pool = createPool()
    const connection = await pool.getConnection()

    try {
        if (!(await hasColumn(connection, 'department', 'department_code'))) {
            await connection.execute(
                `
                ALTER TABLE department
                ADD COLUMN department_code varchar(20) NOT NULL DEFAULT ''
                `
            )
        }

        if (!(await hasIndex(connection, 'department', 'uniq_department_code'))) {
            await connection.execute(
                `
                ALTER TABLE department
                ADD UNIQUE KEY uniq_department_code (department_code)
                `
            )
        }

        if (!(await hasColumn(connection, 'role', 'department_id'))) {
            await connection.execute(
                `
                ALTER TABLE role
                ADD COLUMN department_id int NULL
                `
            )
        }

        if (!(await hasIndex(connection, 'role', 'idx_role_department_id'))) {
            await connection.execute(
                `
                ALTER TABLE role
                ADD KEY idx_role_department_id (department_id)
                `
            )
        }

        console.log('master data schema is ready')
    } finally {
        connection.release()
        await pool.end()
    }
}

main().catch((error) => {
    console.error('Setup master data failed:', error)
    process.exitCode = 1
})
