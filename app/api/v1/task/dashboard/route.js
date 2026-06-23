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

const validPriority = [
    'low',
    'medium',
    'high',
    'critical',
]

const validDue = [
    'all',
    'overdue',
    'next7',
    'next30',
]

function buildFilterConditions(filters) {
    const where = []
    const values = []

    if (
        filters.project_id &&
        filters.project_id !== 'all' &&
        /^\d+$/.test(filters.project_id)
    ) {
        where.push('t.project_id = ?')
        values.push(Number(filters.project_id))
    }

    if (
        filters.status &&
        filters.status !== 'all' &&
        validStatus.includes(filters.status)
    ) {
        where.push('t.status = ?')
        values.push(filters.status)
    }

    if (
        filters.priority &&
        filters.priority !== 'all' &&
        validPriority.includes(filters.priority)
    ) {
        where.push('t.priority = ?')
        values.push(filters.priority)
    }

    if (
        filters.due &&
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
    }

    return {
        where,
        values,
    }
}

function buildTaskScope({
    isAdminView,
    userId,
    filters,
}) {
    const filterResult =
        buildFilterConditions(filters)

    const from = isAdminView
        ? `
            FROM task t
            INNER JOIN project p
                ON t.project_id = p.project_id
        `
        : `
            FROM task_assignment ta
            INNER JOIN task t
                ON ta.task_id = t.task_id
            INNER JOIN project p
                ON t.project_id = p.project_id
        `

    const where = [
        't.deleted_at IS NULL',
        'p.deleted_at IS NULL',
    ]

    const values = []

    if (!isAdminView) {
        where.push('ta.user_id = ?')
        values.push(userId)
    }

    where.push(...filterResult.where)
    values.push(...filterResult.values)

    return {
        from,
        whereSql: `WHERE ${where.join(' AND ')}`,
        values,
    }
}

async function getAvailableProjects({
    isAdminView,
    userId,
}) {
    if (isAdminView) {
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
        FROM project_member pm
        INNER JOIN project p
            ON pm.project_id = p.project_id
        WHERE pm.user_id = ?
        AND p.deleted_at IS NULL
        ORDER BY p.project_name ASC
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

        const { searchParams } =
            new URL(request.url)

        const requestedView =
            searchParams.get('view') || 'mine'

        const canViewAdmin = hasTaskWideAccess(user)

        const viewMode =
            requestedView === 'admin' && canViewAdmin
                ? 'admin'
                : 'mine'

        const isAdminView = viewMode === 'admin'

        const filters = {
            project_id:
                searchParams.get('project_id') || 'all',
            status:
                searchParams.get('status') || 'all',
            priority:
                searchParams.get('priority') || 'all',
            due:
                searchParams.get('due') || 'all',
        }

        const taskScope = buildTaskScope({
            isAdminView,
            userId,
            filters,
        })

        const availableProjects =
            await getAvailableProjects({
                isAdminView,
                userId,
            })

        const [summaryRows] = await db.execute(
            `
            SELECT
                COUNT(DISTINCT t.project_id) AS total_projects,

                COUNT(t.task_id) AS total_tasks,

                COALESCE(SUM(
                    CASE
                        WHEN t.status = 'done'
                        THEN 1 ELSE 0
                    END
                ), 0) AS completed_tasks,

                COALESCE(SUM(
                    CASE
                        WHEN t.status = 'in_progress'
                        THEN 1 ELSE 0
                    END
                ), 0) AS in_progress_tasks,

                COALESCE(SUM(
                    CASE
                        WHEN t.status != 'done'
                        AND t.due_date IS NOT NULL
                        AND t.due_date < CURDATE()
                        THEN 1 ELSE 0
                    END
                ), 0) AS overdue_tasks

            ${taskScope.from}
            ${taskScope.whereSql}
            `,
            taskScope.values
        )

        const upcomingWhere = [
            taskScope.whereSql.replace('WHERE', ''),
            `
            t.status != 'done'
            AND t.due_date IS NOT NULL
            `,
        ]

        if (filters.due === 'all') {
            upcomingWhere.push(`
                t.due_date >= CURDATE()
            `)
        }

        const [upcomingRows] = await db.execute(
            `
            SELECT
                t.task_id,
                t.task_name,
                t.priority,
                t.status,
                t.due_date,
                DATEDIFF(t.due_date, CURDATE()) AS days_left,
                p.project_name
            ${taskScope.from}
            WHERE ${upcomingWhere.join(' AND ')}
            ORDER BY t.due_date ASC
            LIMIT 5
            `,
            taskScope.values
        )

        const [myTaskRows] = await db.execute(
            `
            SELECT
                t.task_id,
                t.task_name,
                t.description,
                t.priority,
                t.status,
                t.start_date,
                t.due_date,
                p.project_id,
                p.project_name
            ${taskScope.from}
            ${taskScope.whereSql}
            ORDER BY
                CASE
                    WHEN t.status = 'done'
                    THEN 1 ELSE 0
                END,
                t.due_date IS NULL,
                t.due_date ASC,
                t.updated_at DESC
            LIMIT 10
            `,
            taskScope.values
        )

        const [kanbanRows] = await db.execute(
            `
            SELECT
                t.task_id,
                t.task_name,
                t.priority,
                t.status,
                t.due_date,
                p.project_id,
                p.project_name
            ${taskScope.from}
            ${taskScope.whereSql}
            ORDER BY t.updated_at DESC
            LIMIT 120
            `,
            taskScope.values
        )

        const activityFilter =
            buildFilterConditions(filters)

        const activityWhere = [
            't.deleted_at IS NULL',
            'p.deleted_at IS NULL',
        ]

        const activityValues = []

        if (!isAdminView) {
            activityWhere.push(`
                EXISTS (
                    SELECT 1
                    FROM task_assignment ta
                    WHERE ta.task_id = th.task_id
                    AND ta.user_id = ?
                )
            `)

            activityValues.push(userId)
        }

        activityWhere.push(...activityFilter.where)
        activityValues.push(...activityFilter.values)

        const [activityRows] = await db.execute(
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
                th.created_at,
                t.task_name,
                p.project_name,
                CONCAT(
                    u.first_name_th,
                    ' ',
                    u.last_name_th
                ) AS action_by_name
            FROM task_history th
            INNER JOIN task t
                ON th.task_id = t.task_id
            INNER JOIN project p
                ON t.project_id = p.project_id
            INNER JOIN user u
                ON th.action_by = u.id
            WHERE ${activityWhere.join(' AND ')}
            ORDER BY th.created_at DESC
            LIMIT 8
            `,
            activityValues
        )

        const kanban = {
            todo: [],
            in_progress: [],
            review: [],
            done: [],
        }

        kanbanRows.forEach((task) => {
            if (kanban[task.status]) {
                kanban[task.status].push(task)
            }
        })

        return NextResponse.json({
            success: true,
            view_mode: viewMode,
            can_view_admin: canViewAdmin,
            filters,
            available_projects: availableProjects,
            summary: {
                total_projects:
                    summaryRows[0]?.total_projects || 0,

                total_tasks:
                    summaryRows[0]?.total_tasks || 0,

                completed_tasks:
                    summaryRows[0]?.completed_tasks || 0,

                in_progress_tasks:
                    summaryRows[0]?.in_progress_tasks || 0,

                overdue_tasks:
                    summaryRows[0]?.overdue_tasks || 0,
            },
            upcoming_tasks: upcomingRows,
            recent_activities: activityRows,
            my_tasks: myTaskRows,
            kanban,
        })
    } catch (error) {
        console.error('Task dashboard error:', error)

        return NextResponse.json(
            {
                success: false,
                message:
                    'ไม่สามารถโหลดข้อมูล Dashboard งานได้',
            },
            { status: 500 }
        )
    }
}
