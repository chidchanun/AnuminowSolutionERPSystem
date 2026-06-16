import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export const dynamic = 'force-dynamic'

const validProjectStatus = [
    'all',
    'planning',
    'active',
    'completed',
    'cancelled',
]

function buildProjectWhere({
    userId,
    role,
    isAdminView,
    filters,
}) {
    const where = [
        'p.deleted_at IS NULL',
    ]

    const values = []

    const isAdminScope =
        isAdminView && ['Admin', 'Manager'].includes(role)

    if (!isAdminScope) {
        where.push(`
            (
                p.created_by = ?
                OR EXISTS (
                    SELECT 1
                    FROM project_member pm_scope
                    WHERE pm_scope.project_id = p.project_id
                    AND pm_scope.user_id = ?
                )
                OR EXISTS (
                    SELECT 1
                    FROM task t_scope
                    INNER JOIN task_assignment ta_scope
                        ON t_scope.task_id = ta_scope.task_id
                    WHERE t_scope.project_id = p.project_id
                    AND ta_scope.user_id = ?
                    AND t_scope.deleted_at IS NULL
                )
            )
        `)

        values.push(userId, userId, userId)
    }

    if (
        filters.project_id !== 'all' &&
        /^\d+$/.test(filters.project_id)
    ) {
        where.push('p.project_id = ?')
        values.push(Number(filters.project_id))
    }

    if (
        filters.status !== 'all' &&
        validProjectStatus.includes(filters.status)
    ) {
        where.push('p.status = ?')
        values.push(filters.status)
    }

    if (filters.q) {
        where.push(`
            (
                p.project_name LIKE ?
                OR p.project_code LIKE ?
                OR p.description LIKE ?
                OR EXISTS (
                    SELECT 1
                    FROM task t_search
                    WHERE t_search.project_id = p.project_id
                    AND t_search.deleted_at IS NULL
                    AND (
                        t_search.task_name LIKE ?
                        OR t_search.description LIKE ?
                    )
                )
            )
        `)

        const keyword = `%${filters.q}%`

        values.push(
            keyword,
            keyword,
            keyword,
            keyword,
            keyword
        )
    }

    return {
        whereSql: `WHERE ${where.join(' AND ')}`,
        values,
    }
}

async function getAvailableProjects({
    userId,
    role,
    isAdminView,
}) {
    const isAdminScope =
        isAdminView && ['Admin', 'Manager'].includes(role)

    if (isAdminScope) {
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
            AND t.deleted_at IS NULL
        LEFT JOIN task_assignment ta
            ON t.task_id = ta.task_id
        WHERE p.deleted_at IS NULL
        AND (
            p.created_by = ?
            OR pm.user_id = ?
            OR ta.user_id = ?
        )
        ORDER BY p.project_name ASC
        `,
        [userId, userId, userId]
    )

    return rows
}

export async function GET(request) {
    try {
        const accessToken =
            request.cookies.get('accessToken')?.value

        if (!accessToken) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
                },
                { status: 401 }
            )
        }

        const payload = safeVerifyToken(accessToken)

        if (!payload?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Token ไม่ถูกต้อง',
                },
                { status: 401 }
            )
        }

        const userId = payload.id
        const role = payload.permission_role || 'Employee'

        const { searchParams } = new URL(request.url)

        const requestedView =
            searchParams.get('view') || 'mine'

        const canViewAdmin =
            ['Admin', 'Manager'].includes(role)

        const viewMode =
            requestedView === 'admin' && canViewAdmin
                ? 'admin'
                : 'mine'

        const isAdminView =
            viewMode === 'admin'

        const filters = {
            q: (searchParams.get('q') || '').trim(),
            project_id:
                searchParams.get('project_id') || 'all',
            status:
                searchParams.get('status') || 'all',
        }

        const projectWhere = buildProjectWhere({
            userId,
            role,
            isAdminView,
            filters,
        })

        const [projectRows] = await db.execute(
            `
            SELECT
                p.project_id,
                p.project_name,
                p.project_code,
                p.description,
                p.start_date,
                p.end_date,
                p.status,
                p.created_by,
                p.created_at,
                p.updated_at,

                CONCAT(
                    u.first_name_th,
                    ' ',
                    u.last_name_th
                ) AS created_by_name,

                (
                    SELECT COUNT(*)
                    FROM project_member pm_count
                    WHERE pm_count.project_id = p.project_id
                ) AS member_count,

                (
                    SELECT COUNT(*)
                    FROM task t_count
                    WHERE t_count.project_id = p.project_id
                    AND t_count.deleted_at IS NULL
                ) AS task_count,

                (
                    SELECT COUNT(*)
                    FROM task t_done
                    WHERE t_done.project_id = p.project_id
                    AND t_done.status = 'done'
                    AND t_done.deleted_at IS NULL
                ) AS done_task_count

            FROM project p
            INNER JOIN \`user\` u
                ON p.created_by = u.id
            ${projectWhere.whereSql}
            ORDER BY
                p.start_date IS NULL,
                p.start_date ASC,
                p.updated_at DESC
            LIMIT 100
            `,
            projectWhere.values
        )

        const projectIds =
            projectRows.map((project) => project.project_id)

        let taskRows = []

        if (projectIds.length > 0) {
            const placeholders =
                projectIds.map(() => '?').join(',')

            const [rows] = await db.execute(
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
                    t.created_at,
                    t.updated_at,

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
                            ON ta.user_id = au.id
                        WHERE ta.task_id = t.task_id
                    ) AS assignee_names,

                    (
                        SELECT COUNT(*)
                        FROM task_assignment ta_count
                        WHERE ta_count.task_id = t.task_id
                    ) AS assignee_count

                FROM task t
                WHERE t.deleted_at IS NULL
                AND t.project_id IN (${placeholders})
                ORDER BY
                    t.project_id ASC,
                    t.start_date IS NULL,
                    t.start_date ASC,
                    t.due_date IS NULL,
                    t.due_date ASC,
                    t.updated_at DESC
                `,
                projectIds
            )

            taskRows = rows
        }

        const availableProjects =
            await getAvailableProjects({
                userId,
                role,
                isAdminView,
            })

        return NextResponse.json({
            success: true,
            role,
            view_mode: viewMode,
            can_view_admin: canViewAdmin,
            projects: projectRows,
            tasks: taskRows,
            options: {
                projects: availableProjects,
            },
            filters,
        })
    } catch (error) {
        console.error('Get project gantt error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ไม่สามารถโหลด Gantt Chart ได้',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}