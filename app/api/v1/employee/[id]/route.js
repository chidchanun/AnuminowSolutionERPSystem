import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasPermissionKey,
    requirePermission,
} from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'

export const dynamic = 'force-dynamic'

export async function GET(request, context) {
    try {
        const auth = await requirePermission(
            request,
            'employee.view'
        )

        if (auth.response) return auth.response

        const user = auth.user
        const { id } = await context.params

        const employeeId = String(id)

        const [employeeRows] = await db.execute(
            `
            SELECT
                u.id,
                u.prefix,
                u.first_name_th,
                u.last_name_th,
                u.first_name_en,
                u.last_name_en,
                u.email,
                u.picture_path,
                u.department_id,
                u.role_id,
                u.status,
                u.created_at,

                d.department_name,
                r.role_name
            FROM \`user\` u
            LEFT JOIN department d
                ON d.department_id = u.department_id
            LEFT JOIN role r
                ON r.role_id = u.role_id
            WHERE u.id = ?
            AND u.deleted_at IS NULL
            LIMIT 1
            `,
            [employeeId]
        )

        const employee = employeeRows[0]

        if (!employee) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบข้อมูลพนักงาน' },
                { status: 404 }
            )
        }

        const [projectRows] = await db.execute(
            `
            SELECT
                p.project_id,
                p.project_name,
                p.project_code,
                p.status,
                p.start_date,
                p.end_date,
                MAX(p.updated_at) AS latest_updated_at
            FROM project_member pm
            INNER JOIN project p
                ON p.project_id = pm.project_id
            WHERE pm.user_id = ?
            AND p.deleted_at IS NULL
            GROUP BY
                p.project_id,
                p.project_name,
                p.project_code,
                p.status,
                p.start_date,
                p.end_date
            ORDER BY latest_updated_at DESC
            LIMIT 10
            `,
            [employeeId]
        )

        const [taskRows] = await db.execute(
            `
            SELECT
                t.task_id,
                t.task_name,
                t.priority,
                t.status,
                t.due_date,
                p.project_id,
                p.project_name
            FROM task_assignment ta
            INNER JOIN task t
                ON t.task_id = ta.task_id
            INNER JOIN project p
                ON p.project_id = t.project_id
            WHERE ta.user_id = ?
            AND t.deleted_at IS NULL
            AND p.deleted_at IS NULL
            ORDER BY
                CASE
                    WHEN t.status = 'done' THEN 2
                    ELSE 1
                END ASC,
                t.due_date ASC
            LIMIT 10
            `,
            [employeeId]
        )

        const [activityRows] = await db.execute(
            `
            SELECT
                th.history_id,
                th.task_id,
                th.action_type,
                th.description,
                th.created_at,
                t.task_name,
                p.project_name
            FROM task_history th
            INNER JOIN task t
                ON t.task_id = th.task_id
            LEFT JOIN project p
                ON p.project_id = t.project_id
            WHERE th.action_by = ?
            ORDER BY th.created_at DESC
            LIMIT 10
            `,
            [employeeId]
        )

        return NextResponse.json({
            success: true,
            employee,
            projects: projectRows,
            tasks: taskRows,
            activities: activityRows,
            permission: {
                can_edit: hasPermissionKey(user, 'employee.update'),
                can_delete:
                    hasPermissionKey(user, 'employee.delete') &&
                    String(user.id) !== String(employeeId),
            },
        })
    } catch (error) {
        console.error('Get employee detail error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดข้อมูลพนักงานไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}

export async function PUT(request, context) {
    try {
        const auth = await requirePermission(
            request,
            'employee.update'
        )

        if (auth.response) return auth.response

        const user = auth.user
        const { id } = await context.params

        const employeeId = String(id)
        const body = await request.json()

        const {
            prefix = '',
            first_name_th = '',
            last_name_th = '',
            first_name_en = '',
            last_name_en = '',
            email = '',
            department_id = null,
            role_id = null,
            status = 'active',
        } = body

        if (!first_name_th.trim() || !last_name_th.trim() || !email.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณากรอกชื่อ นามสกุล และ Email',
                },
                { status: 400 }
            )
        }

        if (!['active', 'inactive', 'resigned'].includes(status)) {
            return NextResponse.json(
                { success: false, message: 'สถานะพนักงานไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        const [result] = await db.execute(
            `
            UPDATE \`user\`
            SET
                prefix = ?,
                first_name_th = ?,
                last_name_th = ?,
                first_name_en = ?,
                last_name_en = ?,
                email = ?,
                department_id = ?,
                role_id = ?,
                status = ?
            WHERE id = ?
            AND deleted_at IS NULL
            `,
            [
                prefix,
                first_name_th,
                last_name_th,
                first_name_en,
                last_name_en,
                email,
                department_id || null,
                role_id || null,
                status,
                employeeId,
            ]
        )

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบพนักงานที่ต้องการแก้ไข' },
                { status: 404 }
            )
        }

        await writeAuditLog({
            actorId: user.id,
            action: 'employee.update',
            entityType: 'employee',
            entityId: employeeId,
            summary: `Update employee ${employeeId}`,
            metadata: {
                email,
                department_id,
                role_id,
                status,
            },
        })

        return NextResponse.json({
            success: true,
            message: 'แก้ไขข้อมูลพนักงานสำเร็จ',
        })
    } catch (error) {
        console.error('Update employee error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'แก้ไขข้อมูลพนักงานไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}

export async function DELETE(request, context) {
    try {
        const auth = await requirePermission(
            request,
            'employee.delete'
        )

        if (auth.response) return auth.response

        const user = auth.user
        const { id } = await context.params

        const employeeId = String(id)
        if (String(user.id) === String(employeeId)) {
            return NextResponse.json(
                { success: false, message: 'ไม่สามารถลบบัญชีของตัวเองได้' },
                { status: 400 }
            )
        }

        const [result] = await db.execute(
            `
            UPDATE \`user\`
            SET
                status = 'inactive',
                deleted_at = CURRENT_TIMESTAMP
            WHERE id = ?
            AND deleted_at IS NULL
            `,
            [employeeId]
        )

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบพนักงานที่ต้องการลบ' },
                { status: 404 }
            )
        }

        await writeAuditLog({
            actorId: user.id,
            action: 'employee.delete',
            entityType: 'employee',
            entityId: employeeId,
            summary: `Delete employee ${employeeId}`,
            metadata: {
                status: 'inactive',
            },
        })

        return NextResponse.json({
            success: true,
            message: 'ลบพนักงานสำเร็จ',
        })
    } catch (error) {
        console.error('Delete employee error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ลบพนักงานไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
