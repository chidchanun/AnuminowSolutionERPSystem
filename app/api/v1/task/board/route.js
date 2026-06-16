import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export const dynamic = 'force-dynamic'

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

const columns = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
}

function buildWhere({
    userId,
    role,
    filters,
    isAdminView,
}) {
    const where = [
        't.deleted_at IS NULL',
        'p.deleted_at IS NULL',
    ]

    const values = []

    const isAdminScope =
        isAdminView && ['Admin', 'Manager'].includes(role)

    const isTeamLead =
        role === 'Team Lead'

    if (!isAdminScope && isTeamLead) {
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

    if (!isAdminScope && !isTeamLead) {
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
        LEFT JOIN task_assignment ta
            ON t.task_id = ta.task_id
        WHERE p.deleted_at IS NULL
        AND (
            pm.user_id = ?
            OR ta.user_id = ?
            OR t.created_by = ?
        )
        ORDER BY p.project_name ASC
        `,
        [userId, userId, userId]
    )

    return rows
}

async function getAvailableAssignees({
    userId,
    role,
}) {
    const canSeeManyUsers =
        ['Admin', 'Manager', 'Team Lead'].includes(role)

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
        `,
        [userId]
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

        const { searchParams } =
            new URL(request.url)

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
            priority:
                searchParams.get('priority') || 'all',
            assignee_id:
                searchParams.get('assignee_id') || 'all',
            due:
                searchParams.get('due') || 'all',
        }

        const taskWhere = buildWhere({
            userId,
            role,
            filters,
            isAdminView,
        })

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
                t.created_at,
                t.updated_at,

                p.project_name,
                p.project_code,

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
            ${taskWhere.whereSql}
            ORDER BY
                CASE t.priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                    ELSE 5
                END ASC,
                t.due_date IS NULL,
                t.due_date ASC,
                t.updated_at DESC
            LIMIT 300
            `,
            taskWhere.values
        )

        const board = {
            todo: [],
            in_progress: [],
            review: [],
            done: [],
        }

        taskRows.forEach((task) => {
            if (board[task.status]) {
                board[task.status].push(task)
            }
        })

        const availableProjects =
            await getAvailableProjects({
                userId,
                role,
                isAdminView,
            })

        const availableAssignees =
            await getAvailableAssignees({
                userId,
                role,
            })

        return NextResponse.json({
            success: true,
            role,
            view_mode: viewMode,
            can_view_admin: canViewAdmin,
            filters,
            board,
            summary: {
                total:
                    taskRows.length,
                todo:
                    board.todo.length,
                in_progress:
                    board.in_progress.length,
                review:
                    board.review.length,
                done:
                    board.done.length,
            },
            options: {
                projects: availableProjects,
                assignees: availableAssignees,
            },
        })
    } catch (error) {
        console.error('Get kanban board error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ไม่สามารถโหลด Kanban Board ได้',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}