import 'dotenv/config'
import mysql from 'mysql2/promise'
import bcrypt from 'bcrypt'

const ADMIN_ID = 'admin'
const ADMIN_PASSWORD = 'admin1234@'
const ADMIN_EMAIL = 'admin@erp.local'

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

async function ensureDepartment(connection) {
    const hasDepartmentCode =
        await hasColumn(connection, 'department', 'department_code')

    if (hasDepartmentCode) {
        const [rows] = await connection.execute(
            `
            SELECT department_id
            FROM department
            WHERE department_code = 'ADM'
            OR department_name = 'Administration'
            ORDER BY department_id ASC
            LIMIT 1
            `
        )

        if (rows[0]) return rows[0].department_id

        const [result] = await connection.execute(
            `
            INSERT INTO department (
                department_name,
                department_code
            )
            VALUES ('Administration', 'ADM')
            `
        )

        return result.insertId
    }

    const [rows] = await connection.execute(
        `
        SELECT department_id
        FROM department
        WHERE department_name = 'Administration'
        ORDER BY department_id ASC
        LIMIT 1
        `
    )

    if (rows[0]) return rows[0].department_id

    const [result] = await connection.execute(
        `
        INSERT INTO department (
            department_name
        )
        VALUES ('Administration')
        `
    )

    return result.insertId
}

async function ensureRole(connection, departmentId) {
    const hasDepartmentId =
        await hasColumn(connection, 'role', 'department_id')

    const [rows] = await connection.execute(
        `
        SELECT role_id
        FROM role
        WHERE role_name = 'System Administrator'
        ORDER BY role_id ASC
        LIMIT 1
        `
    )

    if (rows[0]) return rows[0].role_id

    if (hasDepartmentId) {
        const [result] = await connection.execute(
            `
            INSERT INTO role (
                role_name,
                department_id
            )
            VALUES ('System Administrator', ?)
            `,
            [departmentId]
        )

        return result.insertId
    }

    const [result] = await connection.execute(
        `
        INSERT INTO role (
            role_name
        )
        VALUES ('System Administrator')
        `
    )

    return result.insertId
}

async function ensurePermissionRole(connection) {
    const [rows] = await connection.execute(
        `
        SELECT permission_role_id
        FROM user_permission_role
        WHERE permission_role_name = 'Admin'
        ORDER BY permission_role_id ASC
        LIMIT 1
        `
    )

    if (rows[0]) return rows[0].permission_role_id

    const [result] = await connection.execute(
        `
        INSERT INTO user_permission_role (
            permission_role_name
        )
        VALUES ('Admin')
        `
    )

    return result.insertId
}

async function ensureAdminHasAllPermissions(connection, permissionRoleId) {
    await connection.execute(
        `
        INSERT IGNORE INTO permission_role_map (
            permission_role_id,
            permission_id
        )
        SELECT
            ?,
            permission_id
        FROM permission
        `,
        [permissionRoleId]
    )
}

async function upsertAdminUser({
    connection,
    departmentId,
    roleId,
    permissionRoleId,
}) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)

    await connection.execute(
        `
        INSERT INTO \`user\` (
            id,
            prefix,
            first_name_th,
            last_name_th,
            first_name_en,
            last_name_en,
            email,
            phone,
            picture_path,
            password_hash,
            department_id,
            role_id,
            permission_role_id,
            status
        )
        VALUES (
            ?,
            'นาย',
            'ผู้ดูแล',
            'ระบบ',
            'System',
            'Administrator',
            ?,
            '0000000000',
            NULL,
            ?,
            ?,
            ?,
            ?,
            'active'
        )
        ON DUPLICATE KEY UPDATE
            password_hash = VALUES(password_hash),
            department_id = VALUES(department_id),
            role_id = VALUES(role_id),
            permission_role_id = VALUES(permission_role_id),
            status = 'active',
            deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
            ADMIN_ID,
            ADMIN_EMAIL,
            passwordHash,
            departmentId,
            roleId,
            permissionRoleId,
        ]
    )
}

async function main() {
    const pool = createPool()
    const connection = await pool.getConnection()

    try {
        await connection.beginTransaction()

        const departmentId = await ensureDepartment(connection)
        const roleId = await ensureRole(connection, departmentId)
        const permissionRoleId = await ensurePermissionRole(connection)

        await ensureAdminHasAllPermissions(connection, permissionRoleId)
        await upsertAdminUser({
            connection,
            departmentId,
            roleId,
            permissionRoleId,
        })

        await connection.commit()

        console.log(
            JSON.stringify(
                {
                    user_id: ADMIN_ID,
                    password: ADMIN_PASSWORD,
                    department_id: departmentId,
                    role_id: roleId,
                    permission_role_id: permissionRoleId,
                },
                null,
                2
            )
        )
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
        await pool.end()
    }
}

main().catch((error) => {
    console.error('Setup admin user failed:', error)
    process.exitCode = 1
})
