import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasPermission,
    requirePermission,
} from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'

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

        const user = auth.user

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

        if (permissionIds.length > 0) {
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

        await writeAuditLog({
            connection,
            actorId: user.id,
            action: 'permission_matrix.update',
            entityType: 'permission_role',
            entityId: permissionRoleId,
            summary: `Update permissions for ${targetRole.permission_role_name}`,
            metadata: {
                permission_role_name:
                    targetRole.permission_role_name,
                permission_ids: permissionIds,
            },
        })

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

export async function POST(request) {
    try {
        const auth = await requirePermission(request, 'permission.manage')

        if (auth.response) return auth.response

        const body = await request.json().catch(() => null)
        const roleName = String(body?.permission_role_name || '').trim()

        if (!roleName) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณากรอกชื่อ Permission Role',
                },
                { status: 400 }
            )
        }

        const [result] = await db.execute(
            `
            INSERT INTO user_permission_role (
                permission_role_name
            )
            VALUES (?)
            `,
            [roleName]
        )

        await writeAuditLog({
            actorId: auth.user.id,
            action: 'permission_role.create',
            entityType: 'permission_role',
            entityId: result.insertId,
            summary: `Create permission role ${roleName}`,
            metadata: {
                permission_role_name: roleName,
            },
        })

        return NextResponse.json(
            {
                success: true,
                message: 'สร้าง Permission Role สำเร็จ',
                permission_role_id: result.insertId,
            },
            { status: 201 }
        )
    } catch (error) {
        console.error('Permission Role POST Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'สร้าง Permission Role ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}

export async function PATCH(request) {
    try {
        const auth = await requirePermission(request, 'permission.manage')

        if (auth.response) return auth.response

        const body = await request.json().catch(() => null)
        const permissionRoleId = Number(body?.permission_role_id)
        const roleName = String(body?.permission_role_name || '').trim()

        if (!permissionRoleId || !roleName) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ข้อมูล Permission Role ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const [oldRows] = await db.execute(
            `
            SELECT permission_role_id, permission_role_name
            FROM user_permission_role
            WHERE permission_role_id = ?
            LIMIT 1
            `,
            [permissionRoleId]
        )

        if (!oldRows[0]) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบ Permission Role',
                },
                { status: 404 }
            )
        }

        await db.execute(
            `
            UPDATE user_permission_role
            SET permission_role_name = ?
            WHERE permission_role_id = ?
            `,
            [roleName, permissionRoleId]
        )

        await writeAuditLog({
            actorId: auth.user.id,
            action: 'permission_role.update',
            entityType: 'permission_role',
            entityId: permissionRoleId,
            summary: `Update permission role ${roleName}`,
            metadata: {
                before: oldRows[0],
                after: {
                    permission_role_id: permissionRoleId,
                    permission_role_name: roleName,
                },
            },
        })

        return NextResponse.json({
            success: true,
            message: 'แก้ไข Permission Role สำเร็จ',
        })
    } catch (error) {
        console.error('Permission Role PATCH Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'แก้ไข Permission Role ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}

export async function DELETE(request) {
    let connection

    try {
        const auth = await requirePermission(request, 'permission.manage')

        if (auth.response) return auth.response

        const body = await request.json().catch(() => null)
        const permissionRoleId = Number(body?.permission_role_id)

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
            SELECT permission_role_id, permission_role_name
            FROM user_permission_role
            WHERE permission_role_id = ?
            LIMIT 1
            `,
            [permissionRoleId]
        )
        const role = roleRows[0]

        if (!role) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบ Permission Role',
                },
                { status: 404 }
            )
        }

        const [[usage]] = await db.execute(
            `
            SELECT COUNT(*) AS total
            FROM \`user\`
            WHERE permission_role_id = ?
            AND deleted_at IS NULL
            `,
            [permissionRoleId]
        )

        if (Number(usage.total || 0) > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่สามารถลบ Permission Role ที่มีผู้ใช้งานอยู่',
                },
                { status: 409 }
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
        await connection.execute(
            `
            DELETE FROM user_permission_role
            WHERE permission_role_id = ?
            `,
            [permissionRoleId]
        )

        await writeAuditLog({
            connection,
            actorId: auth.user.id,
            action: 'permission_role.delete',
            entityType: 'permission_role',
            entityId: permissionRoleId,
            summary: `Delete permission role ${role.permission_role_name}`,
            metadata: role,
        })

        await connection.commit()

        return NextResponse.json({
            success: true,
            message: 'ลบ Permission Role สำเร็จ',
        })
    } catch (error) {
        if (connection) {
            await connection.rollback()
        }

        console.error('Permission Role DELETE Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ลบ Permission Role ไม่สำเร็จ',
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
