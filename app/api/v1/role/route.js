import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'

export async function GET() {
    try {
        const [roles] = await db.query(
            `
            SELECT
                r.*,
                d.department_name
            FROM role r
            LEFT JOIN department d
                ON d.department_id = r.department_id
            ORDER BY d.department_name ASC, r.role_name ASC
            `
        )

        if (!roles) {
            return NextResponse.json({ message: 'ไม่พบข้อมูลตำแหน่ง' }, { status: 404 })
        }

        return NextResponse.json(roles)

    } catch (err) {
        return NextResponse.json({ message: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' }, { status: 500 })
    }
}

export async function POST(request) {
    try {
        const auth = await requirePermission(request, 'master_data.manage')

        if (auth.response) return auth.response

        const body = await request.json().catch(() => null)
        const roleName = String(body?.role_name || '').trim()
        const departmentId = Number(body?.department_id)

        if (!roleName || !departmentId) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณากรอกชื่อตำแหน่งและแผนก',
                },
                { status: 400 }
            )
        }

        const [departmentRows] = await db.query(
            `
            SELECT department_id
            FROM department
            WHERE department_id = ?
            LIMIT 1
            `,
            [departmentId]
        )

        if (!departmentRows[0]) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบแผนก',
                },
                { status: 404 }
            )
        }

        const [result] = await db.query(
            `
            INSERT INTO role (
                role_name,
                department_id
            )
            VALUES (?, ?)
            `,
            [roleName, departmentId]
        )

        await writeAuditLog({
            actorId: auth.user.id,
            action: 'master.role.create',
            entityType: 'role',
            entityId: result.insertId,
            summary: `Create role ${roleName}`,
            metadata: {
                role_name: roleName,
                department_id: departmentId,
            },
        })

        return NextResponse.json(
            {
                success: true,
                message: 'สร้างตำแหน่งสำเร็จ',
                role_id: result.insertId,
            },
            { status: 201 }
        )
    } catch (error) {
        console.error('Create role error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'สร้างตำแหน่งไม่สำเร็จ',
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
    try {
        const auth = await requirePermission(request, 'master_data.manage')

        if (auth.response) return auth.response

        const body = await request.json().catch(() => null)
        const roleId = Number(body?.role_id)
        const roleName = String(body?.role_name || '').trim()
        const departmentId = Number(body?.department_id)

        if (!roleId || !roleName || !departmentId) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ข้อมูลตำแหน่งไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const [oldRows] = await db.query(
            `
            SELECT role_id, role_name, department_id
            FROM role
            WHERE role_id = ?
            LIMIT 1
            `,
            [roleId]
        )

        if (!oldRows[0]) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบตำแหน่ง',
                },
                { status: 404 }
            )
        }

        const [departmentRows] = await db.query(
            `
            SELECT department_id
            FROM department
            WHERE department_id = ?
            LIMIT 1
            `,
            [departmentId]
        )

        if (!departmentRows[0]) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบแผนก',
                },
                { status: 404 }
            )
        }

        await db.query(
            `
            UPDATE role
            SET role_name = ?,
                department_id = ?
            WHERE role_id = ?
            `,
            [roleName, departmentId, roleId]
        )

        await writeAuditLog({
            actorId: auth.user.id,
            action: 'master.role.update',
            entityType: 'role',
            entityId: roleId,
            summary: `Update role ${roleName}`,
            metadata: {
                before: oldRows[0],
                after: {
                    role_id: roleId,
                    role_name: roleName,
                    department_id: departmentId,
                },
            },
        })

        return NextResponse.json({
            success: true,
            message: 'แก้ไขตำแหน่งสำเร็จ',
        })
    } catch (error) {
        console.error('Update role error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'แก้ไขตำแหน่งไม่สำเร็จ',
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
    try {
        const auth = await requirePermission(request, 'master_data.manage')

        if (auth.response) return auth.response

        const body = await request.json().catch(() => null)
        const roleId = Number(body?.role_id)

        if (!roleId) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'role_id ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const [roleRows] = await db.query(
            `
            SELECT role_id, role_name, department_id
            FROM role
            WHERE role_id = ?
            LIMIT 1
            `,
            [roleId]
        )
        const role = roleRows[0]

        if (!role) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบตำแหน่ง',
                },
                { status: 404 }
            )
        }

        const [[usage]] = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM \`user\`
            WHERE role_id = ?
            AND deleted_at IS NULL
            `,
            [roleId]
        )

        if (Number(usage.total || 0) > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่สามารถลบตำแหน่งที่มีพนักงานใช้งานอยู่',
                },
                { status: 409 }
            )
        }

        await db.query(
            `
            DELETE FROM role
            WHERE role_id = ?
            `,
            [roleId]
        )

        await writeAuditLog({
            actorId: auth.user.id,
            action: 'master.role.delete',
            entityType: 'role',
            entityId: roleId,
            summary: `Delete role ${role.role_name}`,
            metadata: role,
        })

        return NextResponse.json({
            success: true,
            message: 'ลบตำแหน่งสำเร็จ',
        })
    } catch (error) {
        console.error('Delete role error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ลบตำแหน่งไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
