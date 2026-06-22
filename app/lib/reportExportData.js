import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

const validReportTypes = [
    'overview',
    'project',
    'task',
    'overdue',
]

export async function getReportAuthUser(request) {
    const accessToken =
        request.cookies.get('accessToken')?.value

    if (!accessToken) {
        return null
    }

    const payload = await safeVerifyToken(accessToken)

    if (!payload?.id) {
        return null
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
        LIMIT 1
        `,
        [payload.id]
    )

    return {
        id: payload.id,
        role: payload.permission_role || 'Employee',
        full_name:
            rows[0]?.full_name ||
            payload.id,
        role_name:
            rows[0]?.role_name ||
            payload.permission_role ||
            'Employee',
    }
}

export function canAccessReport(user) {
    return ['Admin', 'Manager'].includes(user?.role)
}

export function getReportFilters(request) {
    const { searchParams } =
        new URL(request.url)

    const reportType =
        searchParams.get('report_type') || 'overview'

    return {
        report_type: validReportTypes.includes(reportType)
            ? reportType
            : 'overview',
        project_id:
            searchParams.get('project_id') || 'all',
        project_status:
            searchParams.get('project_status') || 'all',
        task_status:
            searchParams.get('task_status') || 'all',
        priority:
            searchParams.get('priority') || 'all',
        from:
            searchParams.get('from') || '',
        to:
            searchParams.get('to') || '',
    }
}

export function getReportTypeLabel(type) {
    switch (type) {
        case 'project':
            return 'รายงานโปรเจกต์'
        case 'task':
            return 'รายงานงาน'
        case 'overdue':
            return 'รายงานงานเกินกำหนด'
        case 'overview':
        default:
            return 'รายงานภาพรวม'
    }
}

export function getStatusLabel(status) {
    switch (status) {
        case 'planning':
            return 'วางแผน'
        case 'active':
            return 'กำลังดำเนินการ'
        case 'completed':
            return 'เสร็จสิ้น'
        case 'cancelled':
            return 'ยกเลิก'
        case 'todo':
            return 'Todo'
        case 'in_progress':
            return 'In Progress'
        case 'review':
            return 'Review'
        case 'done':
            return 'Done'
        default:
            return status || '-'
    }
}

export function getPriorityLabel(priority) {
    switch (priority) {
        case 'low':
            return 'Low'
        case 'medium':
            return 'Medium'
        case 'high':
            return 'High'
        case 'critical':
            return 'Critical'
        default:
            return priority || '-'
    }
}

export function formatFilterValue(key, value) {
    if (!value || value === 'all') {
        return 'ทั้งหมด'
    }

    if (key.includes('status')) {
        return getStatusLabel(value)
    }

    if (key === 'priority') {
        return getPriorityLabel(value)
    }

    return value
}

function buildProjectWhere(filters) {
    const where = [
        'p.deleted_at IS NULL',
    ]

    const values = []

    if (
        filters.project_id !== 'all' &&
        /^\d+$/.test(String(filters.project_id))
    ) {
        where.push('p.project_id = ?')
        values.push(Number(filters.project_id))
    }

    if (
        filters.project_status !== 'all' &&
        filters.project_status
    ) {
        where.push('p.status = ?')
        values.push(filters.project_status)
    }

    if (filters.from && filters.to) {
        where.push(`
            (
                p.start_date IS NULL
                OR p.start_date <= ?
            )
            AND (
                p.end_date IS NULL
                OR p.end_date >= ?
            )
        `)

        values.push(filters.to, filters.from)
    }

    return {
        whereSql: `WHERE ${where.join(' AND ')}`,
        values,
    }
}

function buildTaskWhere(filters) {
    const where = [
        't.deleted_at IS NULL',
        'p.deleted_at IS NULL',
    ]

    const values = []

    if (
        filters.project_id !== 'all' &&
        /^\d+$/.test(String(filters.project_id))
    ) {
        where.push('t.project_id = ?')
        values.push(Number(filters.project_id))
    }

    if (
        filters.project_status !== 'all' &&
        filters.project_status
    ) {
        where.push('p.status = ?')
        values.push(filters.project_status)
    }

    if (
        filters.task_status !== 'all' &&
        filters.task_status
    ) {
        where.push('t.status = ?')
        values.push(filters.task_status)
    }

    if (
        filters.priority !== 'all' &&
        filters.priority
    ) {
        where.push('t.priority = ?')
        values.push(filters.priority)
    }

    if (filters.from && filters.to) {
        where.push(`
            DATE(COALESCE(t.due_date, t.created_at))
            BETWEEN ? AND ?
        `)

        values.push(filters.from, filters.to)
    }

    return {
        whereSql: `WHERE ${where.join(' AND ')}`,
        values,
    }
}

export async function getReportExportData(filters) {
    const projectWhere =
        buildProjectWhere(filters)

    const taskWhere =
        buildTaskWhere(filters)

    const [projectSummaryRows] =
        await db.execute(
            `
            SELECT
                COUNT(*) AS total_projects,
                SUM(p.status = 'planning') AS planning_projects,
                SUM(p.status = 'active') AS active_projects,
                SUM(p.status = 'completed') AS completed_projects,
                SUM(p.status = 'cancelled') AS cancelled_projects,
                SUM(
                    p.status != 'completed'
                    AND p.end_date IS NOT NULL
                    AND p.end_date < CURDATE()
                ) AS overdue_projects
            FROM project p
            ${projectWhere.whereSql}
            `,
            projectWhere.values
        )

    const [taskSummaryRows] =
        await db.execute(
            `
            SELECT
                COUNT(*) AS total_tasks,
                SUM(t.status = 'todo') AS todo_tasks,
                SUM(t.status = 'in_progress') AS in_progress_tasks,
                SUM(t.status = 'review') AS review_tasks,
                SUM(t.status = 'done') AS done_tasks,
                SUM(
                    t.status != 'done'
                    AND t.due_date IS NOT NULL
                    AND t.due_date < CURDATE()
                ) AS overdue_tasks
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
            ${taskWhere.whereSql}
            `,
            taskWhere.values
        )

    const [projectStatusRows] =
        await db.execute(
            `
            SELECT
                p.status,
                COUNT(*) AS count
            FROM project p
            ${projectWhere.whereSql}
            GROUP BY p.status
            ORDER BY count DESC
            `,
            projectWhere.values
        )

    const [taskStatusRows] =
        await db.execute(
            `
            SELECT
                t.status,
                COUNT(*) AS count
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
            ${taskWhere.whereSql}
            GROUP BY t.status
            ORDER BY count DESC
            `,
            taskWhere.values
        )

    const [taskPriorityRows] =
        await db.execute(
            `
            SELECT
                t.priority,
                COUNT(*) AS count
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
            ${taskWhere.whereSql}
            GROUP BY t.priority
            ORDER BY
                CASE t.priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                    ELSE 5
                END ASC
            `,
            taskWhere.values
        )

    const [taskRows] =
        await db.execute(
            `
            SELECT
                t.task_id,
                t.task_name,
                t.priority,
                t.status,
                t.start_date,
                t.due_date,
                t.completed_at,
                t.created_at,
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
                    FROM task_assignment ta
                    INNER JOIN \`user\` au
                        ON au.id = ta.user_id
                    WHERE ta.task_id = t.task_id
                ) AS assignee_names
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
            INNER JOIN \`user\` creator
                ON creator.id = t.created_by
            ${taskWhere.whereSql}
            ORDER BY t.updated_at DESC
            LIMIT 1000
            `,
            taskWhere.values
        )

    const [overdueTaskRows] =
        await db.execute(
            `
            SELECT
                t.task_id,
                t.task_name,
                t.priority,
                t.status,
                t.start_date,
                t.due_date,
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
                    FROM task_assignment ta
                    INNER JOIN \`user\` au
                        ON au.id = ta.user_id
                    WHERE ta.task_id = t.task_id
                ) AS assignee_names
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
            INNER JOIN \`user\` creator
                ON creator.id = t.created_by
            ${taskWhere.whereSql}
            AND t.status != 'done'
            AND t.due_date IS NOT NULL
            AND t.due_date < CURDATE()
            ORDER BY t.due_date ASC
            LIMIT 1000
            `,
            taskWhere.values
        )

    const [projectPerformanceRows] =
        await db.execute(
            `
            SELECT
                p.project_id,
                p.project_name,
                p.project_code,
                p.status,
                p.start_date,
                p.end_date,

                COUNT(t.task_id) AS total_tasks,
                SUM(t.status = 'done') AS done_tasks,
                SUM(t.status != 'done') AS pending_tasks,
                SUM(
                    t.status != 'done'
                    AND t.due_date IS NOT NULL
                    AND t.due_date < CURDATE()
                ) AS overdue_tasks,

                CASE
                    WHEN COUNT(t.task_id) = 0 THEN 0
                    ELSE ROUND(
                        SUM(t.status = 'done') * 100 / COUNT(t.task_id),
                        2
                    )
                END AS progress_percent

            FROM project p
            LEFT JOIN task t
                ON t.project_id = p.project_id
                AND t.deleted_at IS NULL
            ${projectWhere.whereSql}
            GROUP BY
                p.project_id,
                p.project_name,
                p.project_code,
                p.status,
                p.start_date,
                p.end_date
            ORDER BY p.updated_at DESC
            LIMIT 1000
            `,
            projectWhere.values
        )

    return {
        filters,
        generated_at: new Date().toISOString(),
        summary: {
            project:
                projectSummaryRows[0] || {},
            task:
                taskSummaryRows[0] || {},
        },
        charts: {
            project_status: projectStatusRows,
            task_status: taskStatusRows,
            task_priority: taskPriorityRows,
        },
        tasks: taskRows,
        overdue_tasks: overdueTaskRows,
        project_performance: projectPerformanceRows,
    }
}