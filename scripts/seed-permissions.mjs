import 'dotenv/config'
import mysql from 'mysql2/promise'
import { permissionCatalog } from '../app/lib/permissionCatalog.js'

const dryRun = process.argv.includes('--dry-run')

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

async function getPermissionMap(connection) {
    const [rows] = await connection.execute(
        `
        SELECT
            permission_id,
            permission_key
        FROM permission
        `
    )

    return new Map(
        rows.map((row) => [
            row.permission_key,
            row.permission_id,
        ])
    )
}

async function getRoleMap(connection) {
    const [rows] = await connection.execute(
        `
        SELECT
            permission_role_id,
            permission_role_name
        FROM user_permission_role
        `
    )

    return new Map(
        rows.map((row) => [
            row.permission_role_name,
            row.permission_role_id,
        ])
    )
}

async function ensurePermissions(connection) {
    const permissionMap = await getPermissionMap(connection)
    const inserted = []

    for (const item of permissionCatalog) {
        if (permissionMap.has(item.key)) {
            continue
        }

        inserted.push(item.key)

        if (dryRun) {
            continue
        }

        await connection.execute(
            `
            INSERT INTO permission (
                permission_key,
                permission_name,
                module_name
            )
            VALUES (?, ?, ?)
            `,
            [
                item.key,
                item.name,
                item.module,
            ]
        )
    }

    return inserted
}

async function ensureRoleMaps(connection) {
    const permissionMap = await getPermissionMap(connection)
    const roleMap = await getRoleMap(connection)
    const inserted = []

    for (const item of permissionCatalog) {
        const permissionId = permissionMap.get(item.key)

        if (!permissionId) {
            continue
        }

        const roleNames = new Set([
            'Admin',
            ...(item.defaultRoles || []),
        ])

        for (const roleName of roleNames) {
            const roleId = roleMap.get(roleName)

            if (!roleId) {
                continue
            }

            inserted.push({
                roleName,
                permissionKey: item.key,
            })

            if (dryRun) {
                continue
            }

            await connection.execute(
                `
                INSERT IGNORE INTO permission_role_map (
                    permission_role_id,
                    permission_id
                )
                VALUES (?, ?)
                `,
                [
                    roleId,
                    permissionId,
                ]
            )
        }
    }

    return inserted
}

async function main() {
    const pool = createPool()
    const connection = await pool.getConnection()

    try {
        await connection.beginTransaction()

        const insertedPermissions =
            await ensurePermissions(connection)

        const insertedRoleMaps =
            await ensureRoleMaps(connection)

        if (dryRun) {
            await connection.rollback()
        } else {
            await connection.commit()
        }

        console.log(
            JSON.stringify(
                {
                    dry_run: dryRun,
                    permission_count: permissionCatalog.length,
                    inserted_permissions: insertedPermissions,
                    role_map_candidates: insertedRoleMaps.length,
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
    console.error('Seed permissions failed:', error)
    process.exitCode = 1
})
