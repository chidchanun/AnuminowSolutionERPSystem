import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasTaskRelatedAccess,
    hasTaskWideAccess,
    requirePermission,
} from '@/app/lib/permission'

export const dynamic = 'force-dynamic'

function buildTaskScope(user) {
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
                t.created_by = ?
                OR EXISTS (
                    SELECT 1
                    FROM project_member pm
                    WHERE pm.project_id = t.project_id
                    AND pm.user_id = ?
                )
                OR EXISTS (
                    SELECT 1
                    FROM task_assignment ta
                    WHERE ta.task_id = t.task_id
                    AND ta.user_id = ?
                )
            )
        `)

        values.push(userId, userId, userId)
    }

    if (!canViewAll && !canViewRelated) {
        where.push(`
            EXISTS (
                SELECT 1
                FROM task_assignment ta
                WHERE ta.task_id = t.task_id
                AND ta.user_id = ?
            )
        `)

        values.push(userId)
    }

    return {
        whereSql: where.join(' AND '),
        values,
    }
}

export async function GET(request) {
    try {
        const auth = await requirePermission(
            request,
            'dashboard.view'
        )

        if (auth.response) return auth.response

        const user = auth.user
        const userId = user.id
        const taskScope = buildTaskScope(user)

        const [[employeeStats]] = await db.execute(
            `
            SELECT
                COUNT(*) AS employees
            FROM \`user\`
            `
        )

        const [[departmentStats]] = await db.execute(
            `
            SELECT
                COUNT(*) AS departments
            FROM department
            `
        )

        const [[projectStats]] = await db.execute(
            `
            SELECT
                COUNT(*) AS total_projects,
                SUM(status = 'active') AS active_projects,
                SUM(status = 'completed') AS completed_projects
            FROM project
            WHERE deleted_at IS NULL
            `
        )

        const [[taskStats]] = await db.execute(
            `
            SELECT
                COUNT(*) AS total_tasks,
                SUM(t.status = 'todo') AS todo_tasks,
                SUM(t.status = 'in_progress') AS in_progress_tasks,
                SUM(t.status = 'review') AS review_tasks,
                SUM(t.status = 'done') AS done_tasks,
                SUM(
                    t.status != 'done'
                    AND t.due_date = CURDATE()
                ) AS today_tasks,
                SUM(
                    t.status != 'done'
                    AND t.due_date IS NOT NULL
                    AND t.due_date < CURDATE()
                ) AS overdue_tasks
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
            WHERE ${taskScope.whereSql}
            `,
            taskScope.values
        )

        const [[notificationStats]] = await db.execute(
            `
            SELECT
                COUNT(*) AS unread_notifications
            FROM notification
            WHERE user_id = ?
            AND read_at IS NULL
            AND deleted_at IS NULL
            `,
            [userId]
        )

        const [taskStatusRows] = await db.execute(
            `
            SELECT
                t.status,
                COUNT(*) AS count
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
            WHERE ${taskScope.whereSql}
            GROUP BY t.status
            `,
            taskScope.values
        )

        const [weeklyRows] = await db.execute(
            `
            SELECT
                DATE(th.created_at) AS activity_date,
                COUNT(*) AS count
            FROM task_history th
            INNER JOIN task t
                ON t.task_id = th.task_id
            INNER JOIN project p
                ON p.project_id = t.project_id
            WHERE ${taskScope.whereSql}
            AND th.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(th.created_at)
            ORDER BY activity_date ASC
            `,
            taskScope.values
        )

        const [dueSoonRows] = await db.execute(
            `
            SELECT
                t.task_id,
                t.task_name,
                t.priority,
                t.status,
                t.due_date,
                p.project_name
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
            WHERE ${taskScope.whereSql}
            AND t.status != 'done'
            AND t.due_date IS NOT NULL
            AND t.due_date BETWEEN CURDATE()
                AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
            ORDER BY t.due_date ASC
            LIMIT 8
            `,
            taskScope.values
        )

        const [activityRows] = await db.execute(
            `
            SELECT
                th.history_id,
                th.action_type,
                th.description,
                th.created_at,
                t.task_id,
                t.task_name,
                p.project_name,
                CONCAT(
                    u.first_name_th,
                    ' ',
                    u.last_name_th
                ) AS action_by_name
            FROM task_history th
            INNER JOIN task t
                ON t.task_id = th.task_id
            INNER JOIN project p
                ON p.project_id = t.project_id
            INNER JOIN \`user\` u
                ON u.id = th.action_by
            WHERE ${taskScope.whereSql}
            ORDER BY th.created_at DESC
            LIMIT 8
            `,
            taskScope.values
        )

        return NextResponse.json({
            success: true,
            stats: {
                employees: Number(employeeStats.employees || 0),
                departments: Number(departmentStats.departments || 0),
                total_projects: Number(projectStats.total_projects || 0),
                active_projects: Number(projectStats.active_projects || 0),
                completed_projects: Number(projectStats.completed_projects || 0),
                total_tasks: Number(taskStats.total_tasks || 0),
                today_tasks: Number(taskStats.today_tasks || 0),
                overdue_tasks: Number(taskStats.overdue_tasks || 0),
                unread_notifications: Number(notificationStats.unread_notifications || 0),
            },
            task_status: taskStatusRows,
            weekly_activity: weeklyRows,
            due_soon_tasks: dueSoonRows,
            latest_activities: activityRows,
        })
    } catch (error) {
        console.error('Dashboard API Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดข้อมูล Dashboard ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
