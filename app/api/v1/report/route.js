import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

const allowedRoles = ['Admin', 'Manager']

function normalizeFilter(value) {
    if (!value || value === 'all') {
        return ''
    }

    return String(value).trim()
}

function buildProjectWhere({
    projectId,
    projectStatus,
    dateFrom,
    dateTo,
}) {
    const where = [
        'p.deleted_at IS NULL',
    ]

    const values = []

    if (projectId) {
        where.push('p.project_id = ?')
        values.push(projectId)
    }

    if (projectStatus) {
        where.push('p.status = ?')
        values.push(projectStatus)
    }

    if (dateFrom) {
        where.push('(p.end_date IS NULL OR p.end_date >= ?)')
        values.push(dateFrom)
    }

    if (dateTo) {
        where.push('(p.start_date IS NULL OR p.start_date <= ?)')
        values.push(dateTo)
    }

    return {
        sql: where.join(' AND '),
        values,
    }
}

function buildTaskWhere({
    projectId,
    taskStatus,
    priority,
    dateFrom,
    dateTo,
}) {
    const where = [
        't.deleted_at IS NULL',
        'p.deleted_at IS NULL',
    ]

    const values = []

    if (projectId) {
        where.push('t.project_id = ?')
        values.push(projectId)
    }

    if (taskStatus) {
        where.push('t.status = ?')
        values.push(taskStatus)
    }

    if (priority) {
        where.push('t.priority = ?')
        values.push(priority)
    }

    if (dateFrom) {
        where.push(`
            (
                t.start_date >= ?
                OR t.due_date >= ?
                OR DATE(t.completed_at) >= ?
            )
        `)

        values.push(dateFrom, dateFrom, dateFrom)
    }

    if (dateTo) {
        where.push(`
            (
                t.start_date <= ?
                OR t.due_date <= ?
                OR DATE(t.completed_at) <= ?
            )
        `)

        values.push(dateTo, dateTo, dateTo)
    }

    return {
        sql: where.join(' AND '),
        values,
    }
}

export async function GET(request) {
    try {
        const token =
            request.cookies.get('accessToken')?.value

        if (!token) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Unauthorized',
                },
                {
                    status: 401,
                }
            )
        }

        const payload =
            await safeVerifyToken(token)

        if (!payload) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Invalid token',
                },
                {
                    status: 401,
                }
            )
        }

        const role =
            payload.permission_role ||
            payload.role ||
            ''

        if (!allowedRoles.includes(role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่มีสิทธิ์เข้าถึงรายงาน',
                },
                {
                    status: 403,
                }
            )
        }

        const { searchParams } =
            new URL(request.url)

        const projectId =
            normalizeFilter(
                searchParams.get('project_id')
            )

        const projectStatus =
            normalizeFilter(
                searchParams.get('project_status')
            )

        const taskStatus =
            normalizeFilter(
                searchParams.get('task_status')
            )

        const priority =
            normalizeFilter(
                searchParams.get('priority')
            )

        const dateFrom =
            normalizeFilter(
                searchParams.get('from')
            )

        const dateTo =
            normalizeFilter(
                searchParams.get('to')
            )

        const projectWhere =
            buildProjectWhere({
                projectId,
                projectStatus,
                dateFrom,
                dateTo,
            })

        const taskWhere =
            buildTaskWhere({
                projectId,
                taskStatus,
                priority,
                dateFrom,
                dateTo,
            })

        const [
            projectSummaryRows,
            taskSummaryRows,
            projectStatusRows,
            taskStatusRows,
            taskPriorityRows,
            overdueTaskRows,
            performanceRows,
            projectOptionRows,
        ] = await Promise.all([
            db.execute(
                `
                SELECT
                    COUNT(*) AS total_projects,

                    COALESCE(SUM(CASE WHEN p.status = 'planning' THEN 1 ELSE 0 END), 0)
                        AS planning_projects,

                    COALESCE(SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END), 0)
                        AS active_projects,

                    COALESCE(SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END), 0)
                        AS completed_projects,

                    COALESCE(SUM(CASE WHEN p.status = 'cancelled' THEN 1 ELSE 0 END), 0)
                        AS cancelled_projects,

                    COALESCE(SUM(
                        CASE
                            WHEN p.end_date IS NOT NULL
                            AND p.end_date < CURDATE()
                            AND p.status NOT IN ('completed', 'cancelled')
                            THEN 1
                            ELSE 0
                        END
                    ), 0) AS overdue_projects
                FROM project p
                WHERE ${projectWhere.sql}
                `,
                projectWhere.values
            ),

            db.execute(
                `
                SELECT
                    COUNT(*) AS total_tasks,

                    COALESCE(SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END), 0)
                        AS todo_tasks,

                    COALESCE(SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END), 0)
                        AS in_progress_tasks,

                    COALESCE(SUM(CASE WHEN t.status = 'review' THEN 1 ELSE 0 END), 0)
                        AS review_tasks,

                    COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0)
                        AS done_tasks,

                    COALESCE(SUM(CASE WHEN t.priority = 'low' THEN 1 ELSE 0 END), 0)
                        AS low_tasks,

                    COALESCE(SUM(CASE WHEN t.priority = 'medium' THEN 1 ELSE 0 END), 0)
                        AS medium_tasks,

                    COALESCE(SUM(CASE WHEN t.priority = 'high' THEN 1 ELSE 0 END), 0)
                        AS high_tasks,

                    COALESCE(SUM(CASE WHEN t.priority = 'critical' THEN 1 ELSE 0 END), 0)
                        AS critical_tasks,

                    COALESCE(SUM(
                        CASE
                            WHEN t.due_date IS NOT NULL
                            AND t.due_date < CURDATE()
                            AND t.status <> 'done'
                            THEN 1
                            ELSE 0
                        END
                    ), 0) AS overdue_tasks
                FROM task t
                INNER JOIN project p
                    ON p.project_id = t.project_id
                WHERE ${taskWhere.sql}
                `,
                taskWhere.values
            ),

            db.execute(
                `
                SELECT
                    p.status,
                    COUNT(*) AS count
                FROM project p
                WHERE ${projectWhere.sql}
                GROUP BY p.status
                ORDER BY count DESC
                `,
                projectWhere.values
            ),

            db.execute(
                `
                SELECT
                    t.status,
                    COUNT(*) AS count
                FROM task t
                INNER JOIN project p
                    ON p.project_id = t.project_id
                WHERE ${taskWhere.sql}
                GROUP BY t.status
                ORDER BY count DESC
                `,
                taskWhere.values
            ),

            db.execute(
                `
                SELECT
                    t.priority,
                    COUNT(*) AS count
                FROM task t
                INNER JOIN project p
                    ON p.project_id = t.project_id
                WHERE ${taskWhere.sql}
                GROUP BY t.priority
                ORDER BY
                    FIELD(t.priority, 'critical', 'high', 'medium', 'low')
                `,
                taskWhere.values
            ),

            db.execute(
                `
                SELECT
                    t.task_id,
                    t.task_name,
                    t.status,
                    t.priority,
                    t.start_date,
                    t.due_date,
                    p.project_id,
                    p.project_name,

                    GROUP_CONCAT(
                        DISTINCT CONCAT(
                            u.first_name_th,
                            ' ',
                            u.last_name_th
                        )
                        SEPARATOR ', '
                    ) AS assignee_names
                FROM task t
                INNER JOIN project p
                    ON p.project_id = t.project_id
                LEFT JOIN task_assignment ta
                    ON ta.task_id = t.task_id
                LEFT JOIN user u
                    ON u.id = ta.user_id
                WHERE ${taskWhere.sql}
                    AND t.due_date IS NOT NULL
                    AND t.due_date < CURDATE()
                    AND t.status <> 'done'
                GROUP BY
                    t.task_id,
                    t.task_name,
                    t.status,
                    t.priority,
                    t.start_date,
                    t.due_date,
                    p.project_id,
                    p.project_name
                ORDER BY t.due_date ASC
                LIMIT 20
                `,
                taskWhere.values
            ),

            db.execute(
                `
                SELECT
                    p.project_id,
                    p.project_name,
                    p.project_code,
                    p.status,
                    p.start_date,
                    p.end_date,

                    COUNT(t.task_id) AS total_tasks,

                    COALESCE(SUM(
                        CASE
                            WHEN t.status = 'done'
                            THEN 1
                            ELSE 0
                        END
                    ), 0) AS done_tasks,

                    COALESCE(SUM(
                        CASE
                            WHEN t.status = 'in_progress'
                            THEN 1
                            ELSE 0
                        END
                    ), 0) AS in_progress_tasks,

                    COALESCE(SUM(
                        CASE
                            WHEN t.status = 'review'
                            THEN 1
                            ELSE 0
                        END
                    ), 0) AS review_tasks,

                    COALESCE(SUM(
                        CASE
                            WHEN t.due_date IS NOT NULL
                            AND t.due_date < CURDATE()
                            AND t.status <> 'done'
                            THEN 1
                            ELSE 0
                        END
                    ), 0) AS overdue_tasks,

                    ROUND(
                        CASE
                            WHEN COUNT(t.task_id) = 0
                            THEN 0
                            ELSE
                                COALESCE(SUM(
                                    CASE
                                        WHEN t.status = 'done'
                                        THEN 1
                                        ELSE 0
                                    END
                                ), 0) * 100 / COUNT(t.task_id)
                        END,
                        0
                    ) AS progress_percent,

                    ROUND(
                        CASE
                            WHEN COALESCE(SUM(
                                CASE
                                    WHEN t.status = 'done'
                                    THEN 1
                                    ELSE 0
                                END
                            ), 0) = 0
                            THEN 0
                            ELSE
                                COALESCE(SUM(
                                    CASE
                                        WHEN t.status = 'done'
                                        AND (
                                            t.due_date IS NULL
                                            OR t.completed_at IS NULL
                                            OR DATE(t.completed_at) <= t.due_date
                                        )
                                        THEN 1
                                        ELSE 0
                                    END
                                ), 0) * 100 /
                                COALESCE(SUM(
                                    CASE
                                        WHEN t.status = 'done'
                                        THEN 1
                                        ELSE 0
                                    END
                                ), 0)
                        END,
                        0
                    ) AS on_time_percent
                FROM project p
                LEFT JOIN task t
                    ON t.project_id = p.project_id
                    AND t.deleted_at IS NULL
                WHERE ${projectWhere.sql}
                GROUP BY
                    p.project_id,
                    p.project_name,
                    p.project_code,
                    p.status,
                    p.start_date,
                    p.end_date
                ORDER BY
                    overdue_tasks DESC,
                    progress_percent ASC,
                    p.project_id DESC
                LIMIT 20
                `,
                projectWhere.values
            ),

            db.execute(
                `
                SELECT
                    project_id,
                    project_name
                FROM project
                WHERE deleted_at IS NULL
                ORDER BY project_name ASC
                `
            ),
        ])

        const projectSummary =
            projectSummaryRows[0][0] || {}

        const taskSummary =
            taskSummaryRows[0][0] || {}

        return NextResponse.json({
            success: true,

            filters: {
                project_id: projectId || 'all',
                project_status: projectStatus || 'all',
                task_status: taskStatus || 'all',
                priority: priority || 'all',
                from: dateFrom || '',
                to: dateTo || '',
            },

            summary: {
                project: projectSummary,
                task: taskSummary,
            },

            charts: {
                project_status:
                    projectStatusRows[0] || [],

                task_status:
                    taskStatusRows[0] || [],

                task_priority:
                    taskPriorityRows[0] || [],
            },

            overdue_tasks:
                overdueTaskRows[0] || [],

            performance:
                performanceRows[0] || [],

            options: {
                projects:
                    projectOptionRows[0] || [],
            },
        })
    } catch (error) {
        console.error('Report API Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดรายงานไม่สำเร็จ',
                error_detail: error.message,
            },
            {
                status: 500,
            }
        )
    }
}