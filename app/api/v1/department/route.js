import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'

export async function GET() {
    try {
        const [rows] = await db.query(
            'SELECT * FROM department ORDER BY department_name ASC'
        )
        return NextResponse.json({ departments: rows , status: 200 , message: 'ดึงข้อมูลแผนกสำเร็จ' })
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request) {
    try {
        const auth = await requirePermission(request, 'master_data.manage')

        if (auth.response) return auth.response

        const body = await request.json().catch(() => null)
        const departmentName = String(body?.department_name || '').trim()
        const departmentCode = String(body?.department_code || '').trim()

        if (!departmentName || !departmentCode) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณากรอกชื่อแผนกและรหัสแผนก',
                },
                { status: 400 }
            )
        }

        const [result] = await db.query(
            `
            INSERT INTO department (
                department_name,
                department_code
            )
            VALUES (?, ?)
            `,
            [departmentName, departmentCode]
        )

        await writeAuditLog({
            actorId: auth.user.id,
            action: 'master.department.create',
            entityType: 'department',
            entityId: result.insertId,
            summary: `Create department ${departmentName}`,
            metadata: {
                department_name: departmentName,
                department_code: departmentCode,
            },
        })

        return NextResponse.json(
            {
                success: true,
                message: 'สร้างแผนกสำเร็จ',
                department_id: result.insertId,
            },
            { status: 201 }
        )
    } catch (error) {
        console.error('Create department error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'สร้างแผนกไม่สำเร็จ',
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
        const departmentId = Number(body?.department_id)
        const departmentName = String(body?.department_name || '').trim()
        const departmentCode = String(body?.department_code || '').trim()

        if (!departmentId || !departmentName || !departmentCode) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ข้อมูลแผนกไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const [oldRows] = await db.query(
            `
            SELECT department_id, department_name, department_code
            FROM department
            WHERE department_id = ?
            LIMIT 1
            `,
            [departmentId]
        )

        if (!oldRows[0]) {
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
            UPDATE department
            SET department_name = ?,
                department_code = ?
            WHERE department_id = ?
            `,
            [departmentName, departmentCode, departmentId]
        )

        await writeAuditLog({
            actorId: auth.user.id,
            action: 'master.department.update',
            entityType: 'department',
            entityId: departmentId,
            summary: `Update department ${departmentName}`,
            metadata: {
                before: oldRows[0],
                after: {
                    department_id: departmentId,
                    department_name: departmentName,
                    department_code: departmentCode,
                },
            },
        })

        return NextResponse.json({
            success: true,
            message: 'แก้ไขแผนกสำเร็จ',
        })
    } catch (error) {
        console.error('Update department error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'แก้ไขแผนกไม่สำเร็จ',
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
        const departmentId = Number(body?.department_id)

        if (!departmentId) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'department_id ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const [departmentRows] = await db.query(
            `
            SELECT department_id, department_name, department_code
            FROM department
            WHERE department_id = ?
            LIMIT 1
            `,
            [departmentId]
        )
        const department = departmentRows[0]

        if (!department) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบแผนก',
                },
                { status: 404 }
            )
        }

        const [[userUsage]] = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM \`user\`
            WHERE department_id = ?
            AND deleted_at IS NULL
            `,
            [departmentId]
        )

        const [[roleUsage]] = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM role
            WHERE department_id = ?
            `,
            [departmentId]
        )

        if (Number(userUsage.total || 0) > 0 || Number(roleUsage.total || 0) > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่สามารถลบแผนกที่มีพนักงานหรือตำแหน่งใช้งานอยู่',
                },
                { status: 409 }
            )
        }

        await db.query(
            `
            DELETE FROM department
            WHERE department_id = ?
            `,
            [departmentId]
        )

        await writeAuditLog({
            actorId: auth.user.id,
            action: 'master.department.delete',
            entityType: 'department',
            entityId: departmentId,
            summary: `Delete department ${department.department_name}`,
            metadata: department,
        })

        return NextResponse.json({
            success: true,
            message: 'ลบแผนกสำเร็จ',
        })
    } catch (error) {
        console.error('Delete department error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ลบแผนกไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
