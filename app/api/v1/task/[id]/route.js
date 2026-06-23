import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasPermissionKey,
    hasTaskRelatedAccess,
    hasTaskWideAccess,
    requirePermission,
} from '@/app/lib/permission'
import { createNotifications } from '@/app/lib/notification'
import { emitNotificationToUsers } from '@/app/lib/socketEmit'
import { writeAuditLog } from '@/app/lib/auditLog'

export const dynamic = 'force-dynamic'

export async function GET(request, context) {
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
        const auth = await requirePermission(
            request,
            'task.view'
        )

        if (auth.response) return auth.response

        const user = auth.user
        const userId = user.id
        const isAdminScope = hasTaskWideAccess(user)
        const canViewRelated = hasTaskRelatedAccess(user)

        const where = [
            't.task_id = ?',
            't.deleted_at IS NULL',
            'p.deleted_at IS NULL',
        ]

        const values = [Number(id)]

        if (!isAdminScope && canViewRelated) {
            where.push(`
                (
                    t.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM project_member pm_scope
                        WHERE pm_scope.project_id = t.project_id
                        AND pm_scope.user_id = ?
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM task_assignment ta_scope
                        WHERE ta_scope.task_id = t.task_id
                        AND ta_scope.user_id = ?
                    )
                )
            `)

            values.push(userId, userId, userId)
        }

        if (!isAdminScope && !canViewRelated) {
            where.push(`
                EXISTS (
                    SELECT 1
                    FROM task_assignment ta_scope
                    WHERE ta_scope.task_id = t.task_id
                    AND ta_scope.user_id = ?
                )
            `)

            values.push(userId)
        }

        const [taskRows] = await db.execute(
            `
            SELECT
                t.task_id,
                t.project_id,
                t.task_name,
                t.description,
                t.priority,
                t.status,
                t.start_date,
                t.due_date,
                t.completed_at,
                t.created_by,
                t.created_at,
                t.updated_at,

                p.project_name,
                p.project_code,
                p.status AS project_status,

                CONCAT(
                    creator.first_name_th,
                    ' ',
                    creator.last_name_th
                ) AS created_by_name,

                creator.picture_path AS created_by_picture

            FROM task t
            INNER JOIN project p
                ON t.project_id = p.project_id
            INNER JOIN \`user\` creator
                ON t.created_by = creator.id
            WHERE ${where.join(' AND ')}
            LIMIT 1
            `,
            values
        )

        const task = taskRows[0]

        if (!task) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบข้อมูลงาน หรือคุณไม่มีสิทธิ์เข้าถึง',
                },
                { status: 404 }
            )
        }

        const [assigneeRows] = await db.execute(
            `
            SELECT
                u.id,
                CONCAT(
                    u.first_name_th,
                    ' ',
                    u.last_name_th
                ) AS full_name,
                u.picture_path,
                r.role_name,
                d.department_name,
                ta.assigned_at
            FROM task_assignment ta
            INNER JOIN \`user\` u
                ON ta.user_id = u.id
            LEFT JOIN role r
                ON u.role_id = r.role_id
            LEFT JOIN department d
                ON u.department_id = d.department_id
            WHERE ta.task_id = ?
            ORDER BY u.first_name_th ASC
            `,
            [Number(id)]
        )

        const [historyRows] = await db.execute(
            `
            SELECT
                th.history_id,
                th.task_id,
                th.target_table,
                th.target_column,
                th.action_type,
                th.old_value,
                th.new_value,
                th.description,
                th.action_by,
                th.created_at,

                CONCAT(
                    u.first_name_th,
                    ' ',
                    u.last_name_th
                ) AS action_by_name,

                u.picture_path AS action_by_picture

            FROM task_history th
            INNER JOIN \`user\` u
                ON th.action_by = u.id
            WHERE th.task_id = ?
            ORDER BY th.created_at DESC
            LIMIT 30
            `,
            [Number(id)]
        )

        const canEdit = hasPermissionKey(user, 'task.update')

        const canDelete = hasPermissionKey(user, 'task.delete')

        return NextResponse.json({
            success: true,
            task,
            assignees: assigneeRows,
            histories: historyRows,
            permission: {
                can_edit: canEdit,
                can_delete: canDelete,
            },
        })
    } catch (error) {
        console.error('Get task detail error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ไม่สามารถโหลดรายละเอียดงานได้',
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

        const {
            project_id,
            task_name,
            description,
            priority = 'medium',
            status = 'todo',
            start_date,
            due_date,
            assignee_ids = [],
        } = body

        const validPriority = [
            'low',
            'medium',
            'high',
            'critical',
        ]

        const validStatus = [
            'todo',
            'in_progress',
            'review',
            'done',
        ]

        if (!project_id || !task_name) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
                },
                { status: 400 }
            )
        }

        if (!validPriority.includes(priority)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Priority ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        if (!validStatus.includes(status)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Status ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const [oldTaskRows] = await db.execute(
            `
            SELECT
                t.*,
                p.project_name
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

        const oldTask = oldTaskRows[0]

        if (!oldTask) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบข้อมูลงาน',
                },
                { status: 404 }
            )
        }

        if (!hasTaskWideAccess(user)) {
            const [accessRows] = await db.execute(
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
                    oldTask.project_id,
                    userId,
                    taskId,
                    userId,
                    taskId,
                    userId,
                ]
            )

            if (accessRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'คุณไม่มีสิทธิ์แก้ไขงานนี้',
                    },
                    { status: 403 }
                )
            }
        }

        const [oldAssignmentRows] = await db.execute(
            `
            SELECT user_id
            FROM task_assignment
            WHERE task_id = ?
            `,
            [taskId]
        )

        const oldAssigneeIds =
            oldAssignmentRows.map((row) => row.user_id)

        const newAssigneeIds = [
            ...new Set(
                assignee_ids
                    .filter(Boolean)
                    .map((item) => String(item))
            ),
        ]

        const completedAt =
            status === 'done'
                ? oldTask.completed_at || new Date()
                : null

        connection = await db.getConnection()
        await connection.beginTransaction()

        await connection.execute(
            `
            UPDATE task
            SET
                project_id = ?,
                task_name = ?,
                description = ?,
                priority = ?,
                status = ?,
                start_date = ?,
                due_date = ?,
                completed_at = ?
            WHERE task_id = ?
            `,
            [
                Number(project_id),
                task_name,
                description || null,
                priority,
                status,
                start_date || null,
                due_date || null,
                completedAt,
                taskId,
            ]
        )

        const historyValues = []

        const addHistory = ({
            targetColumn,
            actionType = 'update',
            oldValue,
            newValue,
            descriptionText,
        }) => {
            historyValues.push([
                taskId,
                'task',
                targetColumn,
                actionType,
                oldValue === null || oldValue === undefined
                    ? null
                    : String(oldValue),
                newValue === null || newValue === undefined
                    ? null
                    : String(newValue),
                descriptionText,
                userId,
            ])
        }

        if (String(oldTask.project_id) !== String(project_id)) {
            addHistory({
                targetColumn: 'project_id',
                oldValue: oldTask.project_id,
                newValue: project_id,
                descriptionText: 'เปลี่ยนโปรเจกต์ของงาน',
            })
        }

        if (oldTask.task_name !== task_name) {
            addHistory({
                targetColumn: 'task_name',
                oldValue: oldTask.task_name,
                newValue: task_name,
                descriptionText: 'แก้ไขชื่องาน',
            })
        }

        if ((oldTask.description || '') !== (description || '')) {
            addHistory({
                targetColumn: 'description',
                oldValue: oldTask.description,
                newValue: description,
                descriptionText: 'แก้ไขรายละเอียดงาน',
            })
        }

        if (oldTask.priority !== priority) {
            addHistory({
                targetColumn: 'priority',
                oldValue: oldTask.priority,
                newValue: priority,
                descriptionText: 'เปลี่ยน Priority',
            })
        }

        if (oldTask.status !== status) {
            addHistory({
                targetColumn: 'status',
                actionType: 'status_change',
                oldValue: oldTask.status,
                newValue: status,
                descriptionText: `เปลี่ยนสถานะจาก ${oldTask.status} เป็น ${status}`,
            })
        }

        if (String(oldTask.start_date || '') !== String(start_date || '')) {
            addHistory({
                targetColumn: 'start_date',
                oldValue: oldTask.start_date,
                newValue: start_date,
                descriptionText: 'เปลี่ยนวันเริ่มต้น',
            })
        }

        if (String(oldTask.due_date || '') !== String(due_date || '')) {
            addHistory({
                targetColumn: 'due_date',
                oldValue: oldTask.due_date,
                newValue: due_date,
                descriptionText: 'เปลี่ยนกำหนดส่ง',
            })
        }

        const oldSet = new Set(oldAssigneeIds)
        const newSet = new Set(newAssigneeIds)
        const addedAssigneeIds =
            newAssigneeIds.filter(
                (newUserId) => !oldSet.has(newUserId)
            )
        const notificationTargetUserIds = []
        for (const oldUserId of oldSet) {
            if (!newSet.has(oldUserId)) {
                historyValues.push([
                    taskId,
                    'task_assignment',
                    'user_id',
                    'unassign',
                    oldUserId,
                    null,
                    `ยกเลิกการมอบหมายงานจาก ${oldUserId}`,
                    userId,
                ])
            }
        }

        for (const newUserId of newSet) {
            if (!oldSet.has(newUserId)) {
                historyValues.push([
                    taskId,
                    'task_assignment',
                    'user_id',
                    'assign',
                    null,
                    newUserId,
                    `มอบหมายงานให้ ${newUserId}`,
                    userId,
                ])
            }
        }

        await connection.execute(
            `
            DELETE FROM task_assignment
            WHERE task_id = ?
            `,
            [taskId]
        )

        if (newAssigneeIds.length > 0) {
            const assignmentValues =
                newAssigneeIds.map((assignedUserId) => [
                    taskId,
                    assignedUserId,
                ])

            await connection.query(
                `
                INSERT INTO task_assignment
                (
                    task_id,
                    user_id
                )
                VALUES ?
                `,
                [assignmentValues]
            )
        }

        if (addedAssigneeIds.length > 0) {
            const assignTargetUserIds =
                addedAssigneeIds.filter(
                    (assignedUserId) =>
                        String(assignedUserId) !== String(userId)
                )

            await createNotifications({
                connection,
                userIds: assignTargetUserIds,
                type: 'task_assigned',
                title: 'คุณถูกมอบหมายงานใหม่',
                message: `คุณถูกมอบหมายงาน: ${task_name}`,
                link: `/dashboard/task/${taskId}`,
                sourceTable: 'task',
                sourceId: taskId,
                createdBy: userId,
            })

            notificationTargetUserIds.push(...assignTargetUserIds)
        }

        if (oldTask.status !== status) {
            const statusTargetUserIds = [
                oldTask.created_by,
                ...newAssigneeIds,
            ].filter(
                (targetUserId) =>
                    targetUserId &&
                    String(targetUserId) !== String(userId)
            )

            await createNotifications({
                connection,
                userIds: statusTargetUserIds,
                type: 'task_status_change',
                title: 'สถานะงานถูกเปลี่ยน',
                message: `งาน "${task_name}" เปลี่ยนสถานะจาก ${oldTask.status} เป็น ${status}`,
                link: `/dashboard/task/${taskId}`,
                sourceTable: 'task',
                sourceId: taskId,
                createdBy: userId,
            })

            notificationTargetUserIds.push(...statusTargetUserIds)
        }

        if (historyValues.length > 0) {
            await connection.query(
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
                VALUES ?
                `,
                [historyValues]
            )
        }

        await writeAuditLog({
            connection,
            actorId: userId,
            action: 'task.update',
            entityType: 'task',
            entityId: taskId,
            summary: `Update task ${task_name}`,
            metadata: {
                project_id,
                priority,
                status,
                assignee_ids: newAssigneeIds,
                changed_fields: historyValues.map((item) => item[2] || item[1]),
            },
        })

        await connection.commit()

        await emitNotificationToUsers(notificationTargetUserIds)

        return NextResponse.json({
            success: true,
            message: 'แก้ไขงานสำเร็จ',
            task_id: taskId,
        })
    } catch (error) {
        if (connection) {
            await connection.rollback()
        }

        console.error('Update task error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ไม่สามารถแก้ไขงานได้',
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

export async function DELETE(request, context) {
    let connection

    try {
        const { id } = await context.params

        if (!id || !/^\d+$/.test(String(id))) {
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
            'task.delete'
        )

        if (auth.response) return auth.response

        const user = auth.user
        const userId = user.id

        const [taskRows] = await db.execute(
            `
            SELECT
                t.task_id,
                t.task_name,
                t.project_id,
                t.created_by,
                p.project_name
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
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
                    message: 'ไม่พบงานที่ต้องการลบ',
                },
                { status: 404 }
            )
        }

        if (!hasTaskWideAccess(user)) {
            const [accessRows] = await db.execute(
                `
                SELECT 1 AS allowed
                FROM task t
                WHERE t.task_id = ?
                AND t.created_by = ?

                UNION

                SELECT 1 AS allowed
                FROM project_member pm
                WHERE pm.project_id = ?
                AND pm.user_id = ?

                UNION

                SELECT 1 AS allowed
                FROM task_assignment ta
                WHERE ta.task_id = ?
                AND ta.user_id = ?

                LIMIT 1
                `,
                [
                    taskId,
                    userId,
                    task.project_id,
                    userId,
                    taskId,
                    userId,
                ]
            )

            if (accessRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'คุณไม่มีสิทธิ์ลบงานนี้',
                    },
                    { status: 403 }
                )
            }
        }

        connection = await db.getConnection()
        await connection.beginTransaction()

        await connection.execute(
            `
            UPDATE task
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE task_id = ?
            AND deleted_at IS NULL
            `,
            [taskId]
        )

        await connection.execute(
            `
            INSERT INTO task_history (
                task_id,
                target_table,
                target_column,
                action_type,
                old_value,
                new_value,
                description,
                action_by
            )
            VALUES (?, 'task', 'deleted_at', 'delete', NULL, 'deleted', ?, ?)
            `,
            [
                taskId,
                `ลบงาน "${task.task_name}"`,
                userId,
            ]
        )

        await writeAuditLog({
            connection,
            actorId: userId,
            action: 'task.delete',
            entityType: 'task',
            entityId: taskId,
            summary: `Delete task ${task.task_name}`,
            metadata: {
                project_id: task.project_id,
                task_name: task.task_name,
            },
        })

        await connection.commit()

        return NextResponse.json({
            success: true,
            message: 'ลบงานสำเร็จ',
            task_id: taskId,
        })
    } catch (error) {
        if (connection) {
            await connection.rollback()
        }

        console.error('Delete task error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ลบงานไม่สำเร็จ',
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
