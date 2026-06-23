import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasTaskRelatedAccess,
    hasTaskWideAccess,
    requirePermission,
} from '@/app/lib/permission'
import { createNotifications } from '@/app/lib/notification'
import { emitNotificationToUsers } from '@/app/lib/socketEmit'
import { writeAuditLog } from '@/app/lib/auditLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const validStatus = [
    'todo',
    'in_progress',
    'review',
    'done',
]

const validPriority = [
    'low',
    'medium',
    'high',
    'critical',
]

const validDue = [
    'all',
    'overdue',
    'today',
    'next7',
    'next30',
    'no_due',
]

const sortMap = {
    newest: 't.created_at DESC',
    updated: 't.updated_at DESC',
    due_asc: 't.due_date IS NULL, t.due_date ASC',
    due_desc: 't.due_date IS NULL, t.due_date DESC',
    priority: `
        CASE t.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
        END ASC
    `,
}

function buildTaskWhere({ user, filters }) {
    const where = [
        't.deleted_at IS NULL',
        'p.deleted_at IS NULL',
    ]

    const values = []

    const userId = user.id
    const canViewAll = hasTaskWideAccess(user)
    const canViewRelated = hasTaskRelatedAccess(user)

    if (!canViewAll && canViewRelated) {
        where.push(`
            (
                EXISTS (
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

        values.push(userId, userId)
    }

    if (!canViewAll && !canViewRelated) {
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

    if (filters.q) {
        where.push(`
            (
                t.task_name LIKE ?
                OR t.description LIKE ?
                OR p.project_name LIKE ?
                OR p.project_code LIKE ?
            )
        `)

        const keyword = `%${filters.q}%`

        values.push(
            keyword,
            keyword,
            keyword,
            keyword
        )
    }

    if (
        filters.project_id !== 'all' &&
        /^\d+$/.test(filters.project_id)
    ) {
        where.push('t.project_id = ?')
        values.push(Number(filters.project_id))
    }

    if (
        filters.status !== 'all' &&
        validStatus.includes(filters.status)
    ) {
        where.push('t.status = ?')
        values.push(filters.status)
    }

    if (
        filters.priority !== 'all' &&
        validPriority.includes(filters.priority)
    ) {
        where.push('t.priority = ?')
        values.push(filters.priority)
    }

    if (
        filters.assignee_id !== 'all' &&
        filters.assignee_id
    ) {
        where.push(`
            EXISTS (
                SELECT 1
                FROM task_assignment ta_filter
                WHERE ta_filter.task_id = t.task_id
                AND ta_filter.user_id = ?
            )
        `)

        values.push(filters.assignee_id)
    }

    if (
        filters.due !== 'all' &&
        validDue.includes(filters.due)
    ) {
        if (filters.due === 'overdue') {
            where.push(`
                t.status != 'done'
                AND t.due_date IS NOT NULL
                AND t.due_date < CURDATE()
            `)
        }

        if (filters.due === 'today') {
            where.push('t.due_date = CURDATE()')
        }

        if (filters.due === 'next7') {
            where.push(`
                t.status != 'done'
                AND t.due_date IS NOT NULL
                AND t.due_date BETWEEN CURDATE()
                AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            `)
        }

        if (filters.due === 'next30') {
            where.push(`
                t.status != 'done'
                AND t.due_date IS NOT NULL
                AND t.due_date BETWEEN CURDATE()
                AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            `)
        }

        if (filters.due === 'no_due') {
            where.push('t.due_date IS NULL')
        }
    }

    return {
        whereSql: `WHERE ${where.join(' AND ')}`,
        values,
    }
}

async function getAvailableProjects({ user }) {
    const userId = user.id

    if (hasTaskWideAccess(user)) {
        const [rows] = await db.execute(`
            SELECT
                project_id,
                project_name
            FROM project
            WHERE deleted_at IS NULL
            ORDER BY project_name ASC
        `)

        return rows
    }

    const [rows] = await db.execute(
        `
        SELECT DISTINCT
            p.project_id,
            p.project_name
        FROM project p
        LEFT JOIN project_member pm
            ON p.project_id = pm.project_id
        LEFT JOIN task t
            ON p.project_id = t.project_id
        LEFT JOIN task_assignment ta
            ON t.task_id = ta.task_id
        WHERE p.deleted_at IS NULL
        AND (
            pm.user_id = ?
            OR ta.user_id = ?
        )
        ORDER BY p.project_name ASC
        `,
        [userId, userId]
    )

    return rows
}

async function getAvailableAssignees({ user }) {
    const userId = user.id
    const canSeeManyUsers = hasTaskRelatedAccess(user)

    if (canSeeManyUsers) {
        const [rows] = await db.execute(`
            SELECT
                u.id,
                CONCAT(
                    u.first_name_th,
                    ' ',
                    u.last_name_th
                ) AS full_name,
                r.role_name
            FROM \`user\` u
            LEFT JOIN role r
                ON u.role_id = r.role_id
            WHERE u.deleted_at IS NULL
            AND u.status = 'active'
            ORDER BY u.first_name_th ASC
        `)

        return rows
    }

    const [rows] = await db.execute(
        `
        SELECT
            u.id,
            CONCAT(
                u.first_name_th,
                ' ',
                u.last_name_th
            ) AS full_name,
            r.role_name
        FROM \`user\` u
        LEFT JOIN role r
            ON u.role_id = r.role_id
        WHERE u.id = ?
        AND u.deleted_at IS NULL
        AND u.status = 'active'
        `,
        [userId]
    )

    return rows
}

export async function GET(request) {
    try {
        const auth = await requirePermission(
            request,
            'task.view'
        )

        if (auth.response) return auth.response

        const user = auth.user
        const userId = user.id

        const { searchParams } = new URL(request.url)

        const pageRaw = Number(searchParams.get('page')) || 1
        const limitRaw = Number(searchParams.get('limit')) || 10

        const page = Math.max(pageRaw, 1)
        const limit = Math.min(Math.max(limitRaw, 1), 50)
        const offset = (page - 1) * limit

        const filters = {
            q: (searchParams.get('q') || '').trim(),
            project_id: searchParams.get('project_id') || 'all',
            status: searchParams.get('status') || 'all',
            priority: searchParams.get('priority') || 'all',
            assignee_id: searchParams.get('assignee_id') || 'all',
            due: searchParams.get('due') || 'all',
        }

        const sort = searchParams.get('sort') || 'updated'
        const orderBy = sortMap[sort] || sortMap.updated

        const taskWhere = buildTaskWhere({
            user,
            filters,
        })

        const [countRows] = await db.execute(
            `
            SELECT COUNT(*) AS total
            FROM task t
            INNER JOIN project p
                ON t.project_id = p.project_id
            ${taskWhere.whereSql}
            `,
            taskWhere.values
        )

        const total = countRows[0]?.total || 0
        const totalPages = Math.max(Math.ceil(total / limit), 1)

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

                CONCAT(
                    creator.first_name_th,
                    ' ',
                    creator.last_name_th
                ) AS created_by_name,

                (
                    SELECT GROUP_CONCAT(
                        DISTINCT CONCAT(
                            au.first_name_th,
                            ' ',
                            au.last_name_th
                        )
                        ORDER BY au.first_name_th
                        SEPARATOR ', '
                    )
                    FROM task_assignment ta2
                    INNER JOIN \`user\` au
                        ON ta2.user_id = au.id
                    WHERE ta2.task_id = t.task_id
                ) AS assignee_names,

                (
                    SELECT COUNT(*)
                    FROM task_assignment ta3
                    WHERE ta3.task_id = t.task_id
                ) AS assignee_count

            FROM task t
            INNER JOIN project p
                ON t.project_id = p.project_id
            INNER JOIN \`user\` creator
                ON t.created_by = creator.id
            ${taskWhere.whereSql}
            ORDER BY ${orderBy}
            LIMIT ${limit} OFFSET ${offset}
            `,
            taskWhere.values
        )

        const availableProjects = await getAvailableProjects({
            user,
        })

        const availableAssignees = await getAvailableAssignees({
            user,
        })

        return NextResponse.json({
            success: true,
            tasks: taskRows,
            filters,
            options: {
                projects: availableProjects,
                assignees: availableAssignees,
            },
            pagination: {
                page,
                limit,
                total,
                total_pages: totalPages,
            },
        })
    } catch (error) {
        console.error('Get tasks error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ไม่สามารถโหลดข้อมูลงานได้',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}

export async function POST(request) {
    let connection

    try {
        const auth = await requirePermission(
            request,
            'task.create'
        )

        if (auth.response) return auth.response

        const user = auth.user
        const userId = user.id

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

        if (!project_id || !task_name) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณากรอกชื่อโปรเจกต์และชื่องาน',
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

        const projectId = Number(project_id)

        if (!projectId) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'project_id ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const [projectRows] = await db.execute(
            `
            SELECT
                project_id,
                project_name,
                created_by
            FROM project
            WHERE project_id = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [projectId]
        )

        const project = projectRows[0]

        if (!project) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบโปรเจกต์',
                },
                { status: 404 }
            )
        }

        if (!hasTaskWideAccess(user)) {
            const [accessRows] = await db.execute(
                `
                SELECT 1 AS allowed
                FROM project_member
                WHERE project_id = ?
                AND user_id = ?

                UNION

                SELECT 1 AS allowed
                FROM project
                WHERE project_id = ?
                AND created_by = ?

                LIMIT 1
                `,
                [
                    projectId,
                    userId,
                    projectId,
                    userId,
                ]
            )

            if (accessRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'คุณไม่มีสิทธิ์สร้างงานในโปรเจกต์นี้',
                    },
                    { status: 403 }
                )
            }
        }

        const cleanAssigneeIds = Array.isArray(assignee_ids)
            ? [
                  ...new Set(
                      assignee_ids
                          .filter(Boolean)
                          .map((item) => String(item))
                  ),
              ]
            : []

        const completedAt =
            status === 'done'
                ? new Date()
                : null

        connection = await db.getConnection()
        await connection.beginTransaction()

        const [result] = await connection.execute(
            `
            INSERT INTO task (
                project_id,
                task_name,
                description,
                priority,
                status,
                start_date,
                due_date,
                completed_at,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                projectId,
                task_name,
                description || null,
                priority,
                status,
                start_date || null,
                due_date || null,
                completedAt,
                userId,
            ]
        )

        const taskId = result.insertId
        const notificationTargetUserIds = []

        if (cleanAssigneeIds.length > 0) {
            const assignmentValues = cleanAssigneeIds.map(
                (assignedUserId) => [
                    taskId,
                    assignedUserId,
                ]
            )

            await connection.query(
                `
                INSERT INTO task_assignment (
                    task_id,
                    user_id
                )
                VALUES ?
                `,
                [assignmentValues]
            )

            const targetUserIds = cleanAssigneeIds.filter(
                (assignedUserId) =>
                    String(assignedUserId) !== String(userId)
            )

            if (targetUserIds.length > 0) {
                await createNotifications({
                    connection,
                    userIds: targetUserIds,
                    type: 'task_assigned',
                    title: 'คุณถูกมอบหมายงานใหม่',
                    message: `คุณถูกมอบหมายงาน: ${task_name}`,
                    link: `/dashboard/task/${taskId}`,
                    sourceTable: 'task',
                    sourceId: taskId,
                    createdBy: userId,
                })

                notificationTargetUserIds.push(...targetUserIds)
            }
        }

        const historyValues = [
            [
                taskId,
                'task',
                null,
                'create',
                null,
                task_name,
                'สร้างงานใหม่',
                userId,
            ],
        ]

        cleanAssigneeIds.forEach((assignedUserId) => {
            historyValues.push([
                taskId,
                'task_assignment',
                'user_id',
                'assign',
                null,
                assignedUserId,
                `มอบหมายงานให้ ${assignedUserId}`,
                userId,
            ])
        })

        if (status !== 'todo') {
            historyValues.push([
                taskId,
                'task',
                'status',
                'status_change',
                'todo',
                status,
                `ตั้งค่าสถานะเริ่มต้นเป็น ${status}`,
                userId,
            ])
        }

        await connection.query(
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
            VALUES ?
            `,
            [historyValues]
        )

        await writeAuditLog({
            connection,
            actorId: userId,
            action: 'task.create',
            entityType: 'task',
            entityId: taskId,
            summary: `Create task ${task_name}`,
            metadata: {
                project_id: projectId,
                priority,
                status,
                assignee_ids: cleanAssigneeIds,
            },
        })

        await connection.commit()

        await emitNotificationToUsers(notificationTargetUserIds)

        return NextResponse.json(
            {
                success: true,
                message: 'สร้างงานสำเร็จ',
                task_id: taskId,
            },
            { status: 201 }
        )
    } catch (error) {
        if (connection) {
            await connection.rollback()
        }

        console.error('Create task error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ไม่สามารถสร้างงานได้',
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
