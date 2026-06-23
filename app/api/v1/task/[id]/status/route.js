import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasTaskWideAccess,
    requirePermission,
} from '@/app/lib/permission'

export const dynamic = 'force-dynamic'

const validStatus = [
    'todo',
    'in_progress',
    'review',
    'done',
]

export async function PATCH(request, context) {
    let connection

    try {
        const { id } = await context.params

        if (!id || !/^\d+$/.test(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Task ID ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const taskId = Number(id)
        const auth = await requirePermission(
            request,
            'task.update'
        )

        if (auth.response) return auth.response

        const user = auth.user
        const userId = user.id

        const body = await request.json()
        const newStatus = body.status

        if (!validStatus.includes(newStatus)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Status ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const [taskRows] = await db.execute(
            `
            SELECT
                t.task_id,
                t.project_id,
                t.status,
                t.created_by
            FROM task t
            INNER JOIN project p
                ON t.project_id = p.project_id
            WHERE t.task_id = ?
            AND t.deleted_at IS NULL
            AND p.deleted_at IS NULL
            LIMIT 1
            `,
            [taskId]
        )

        const task = taskRows[0]

        if (!task) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบข้อมูลงาน',
                },
                { status: 404 }
            )
        }

        const oldStatus = task.status

        if (oldStatus === newStatus) {
            return NextResponse.json({
                success: true,
                message: 'สถานะไม่มีการเปลี่ยนแปลง',
                old_status: oldStatus,
                new_status: newStatus,
            })
        }
        const canUpdate = hasTaskWideAccess(user)
            ? true
            : (await db.execute(
                `
                SELECT 1 AS allowed
                FROM project_member pm
                WHERE pm.project_id = ?
                AND pm.user_id = ?

                UNION

                SELECT 1 AS allowed
                FROM task_assignment ta
                WHERE ta.task_id = ?
                AND ta.user_id = ?

                UNION

                SELECT 1 AS allowed
                FROM task t
                WHERE t.task_id = ?
                AND t.created_by = ?

                LIMIT 1
                `, 
                [
                    task.project_id,
                    userId,
                    taskId,
                    userId,
                    taskId,
                    userId,
                ]
            ))[0].length > 0

        if (!canUpdate) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'คุณไม่มีสิทธิ์เปลี่ยนสถานะงานนี้',
                },
                { status: 403 }
            )
        }

        const completedAt =
            newStatus === 'done'
                ? new Date()
                : null

        connection = await db.getConnection()
        await connection.beginTransaction()

        await connection.execute(
            `
            UPDATE task
            SET
                status = ?,
                completed_at = ?
            WHERE task_id = ?
            `,
            [
                newStatus,
                completedAt,
                taskId,
            ]
        )

        await connection.execute(
            `
            INSERT INTO task_history
            (
                task_id,
                target_table,
                target_column,
                action_type,
                old_value,
                new_value,
                description,
                action_by
            )
            VALUES
            (?, 'task', 'status', 'status_change', ?, ?, ?, ?)
            `,
            [
                taskId,
                oldStatus,
                newStatus,
                `เปลี่ยนสถานะจาก ${oldStatus} เป็น ${newStatus}`,
                userId,
            ]
        )

        await connection.commit()

        return NextResponse.json({
            success: true,
            message: 'เปลี่ยนสถานะงานสำเร็จ',
            task_id: taskId,
            old_status: oldStatus,
            new_status: newStatus,
        })
    } catch (error) {
        if (connection) {
            await connection.rollback()
        }

        console.error('Update task status error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ไม่สามารถเปลี่ยนสถานะงานได้',
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
