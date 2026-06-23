import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasTaskRelatedAccess,
    hasTaskWideAccess,
    requirePermission,
} from '@/app/lib/permission'

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
    user,
    filters,
    isAdminView,
}) {
    const where = [
        't.deleted_at IS NULL',
        'p.deleted_at IS NULL',
    ]

    const values = []
    const userId = user.id

    const isAdminScope =
        isAdminView && hasTaskWideAccess(user)

    const canViewRelated = hasTaskRelatedAccess(user)

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
    user,
    isAdminView,
}) {
    const userId = user.id
    const isAdminScope =
        isAdminView && hasTaskWideAccess(user)

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
    user,
}) {
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
            user,
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
                user,
                isAdminView,
            })

        const availableAssignees =
            await getAvailableAssignees({
                user,
            })

        return NextResponse.json({
            success: true,
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
