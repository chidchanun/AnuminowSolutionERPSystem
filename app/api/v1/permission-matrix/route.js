import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasPermission,
    requirePermission,
} from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const auth = await requirePermission(
            request,
            'permission.view'
        )

        if (auth.response) return auth.response

        const user = auth.user

        const canManage = await hasPermission(
            user.id,
            'permission.manage'
        )

        const [roles] = await db.execute(
            `
            SELECT
                permission_role_id,
                permission_role_name
            FROM user_permission_role
            ORDER BY permission_role_id ASC
            `
        )

        const [permissions] = await db.execute(
            `
            SELECT
                permission_id,
                permission_key,
                permission_name,
                module_name
            FROM permission
            ORDER BY module_name ASC, permission_key ASC
            `
        )

        const [rolePermissions] = await db.execute(
            `
            SELECT
                permission_role_id,
                permission_id
            FROM permission_role_map
            `
        )

        return NextResponse.json({
            success: true,
            roles,
            permissions,
            role_permissions: rolePermissions,
            permission: {
                can_manage: canManage,
            },
        })
    } catch (error) {
        console.error('Permission Matrix GET Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลด Permission Matrix ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}

export async function PUT(request) {
    let connection

    try {
        const auth = await requirePermission(
            request,
            'permission.manage'
        )

        if (auth.response) return auth.response

        const body = await request.json().catch(() => null)

        if (!body) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'รูปแบบข้อมูลไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const permissionRoleId = Number(body.permission_role_id)

        const permissionIds = Array.isArray(body.permission_ids)
            ? [
                  ...new Set(
                      body.permission_ids
                          .map(Number)
                          .filter(Boolean)
                  ),
              ]
            : []

        if (!permissionRoleId) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'permission_role_id ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const [roleRows] = await db.execute(
            `
            SELECT
                permission_role_id,
                permission_role_name
            FROM user_permission_role
            WHERE permission_role_id = ?
            LIMIT 1
            `,
            [permissionRoleId]
        )

        const targetRole = roleRows[0]

        if (!targetRole) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบ Role ที่ต้องการแก้ไข',
                },
                { status: 404 }
            )
        }

        connection = await db.getConnection()
        await connection.beginTransaction()

        await connection.execute(
            `
            DELETE FROM permission_role_map
            WHERE permission_role_id = ?
            `,
            [permissionRoleId]
        )

        if (targetRole.permission_role_name === 'Admin') {
            // กันพลาด: Admin ได้ทุกสิทธิ์เสมอ
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
        } else if (permissionIds.length > 0) {
            for (const permissionId of permissionIds) {
                await connection.execute(
                    `
                    INSERT IGNORE INTO permission_role_map (
                        permission_role_id,
                        permission_id
                    )
                    VALUES (?, ?)
                    `,
                    [
                        permissionRoleId,
                        permissionId,
                    ]
                )
            }
        }

        await connection.commit()

        return NextResponse.json({
            success: true,
            message: 'บันทึก Permission สำเร็จ',
        })
    } catch (error) {
        if (connection) {
            await connection.rollback()
        }

        console.error('Permission Matrix PUT Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'บันทึก Permission ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    } finally {
        if (connection) {
            connection.release()
        }
    }
}