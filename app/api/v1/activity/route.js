import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasTaskRelatedAccess,
    hasTaskWideAccess,
    requirePermission,
} from '@/app/lib/permission'

export const dynamic = 'force-dynamic'

const validActionTypes = [
    'create',
    'update',
    'assign',
    'unassign',
    'status_change',
    'comment',
    'delete',
]

function buildActivityWhere({
    user,
    searchParams,
}) {
    const where = []
    const values = []

    const userId = user.id

    const canViewAll = hasTaskWideAccess(user)
    const canViewRelated = hasTaskRelatedAccess(user)

    if (!canViewAll && canViewRelated) {
        where.push(`
            (
                t.created_by = ?
                OR p.created_by = ?
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

        values.push(userId, userId, userId, userId)
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

    const actionType =
        searchParams.get('action_type') || 'all'

    if (
        actionType !== 'all' &&
        validActionTypes.includes(actionType)
    ) {
        where.push('th.action_type = ?')
        values.push(actionType)
    }

    const projectId =
        searchParams.get('project_id') || ''

    if (/^\d+$/.test(projectId)) {
        where.push('t.project_id = ?')
        values.push(Number(projectId))
    }

    const taskId =
        searchParams.get('task_id') || ''

    if (/^\d+$/.test(taskId)) {
        where.push('th.task_id = ?')
        values.push(Number(taskId))
    }

    const actionBy =
        searchParams.get('action_by') || ''

    if (actionBy.trim()) {
        where.push('th.action_by = ?')
        values.push(actionBy.trim())
    }

    const from =
        searchParams.get('from') || ''

    const to =
        searchParams.get('to') || ''

    if (from && to) {
        where.push('DATE(th.created_at) BETWEEN ? AND ?')
        values.push(from, to)
    } else if (from) {
        where.push('DATE(th.created_at) >= ?')
        values.push(from)
    } else if (to) {
        where.push('DATE(th.created_at) <= ?')
        values.push(to)
    }

    return {
        whereSql:
            where.length > 0
                ? `WHERE ${where.join(' AND ')}`
                : '',
        values,
    }
}

export async function GET(request) {
    try {
        const auth = await requirePermission(
            request,
            'activity.view'
        )

        if (auth.response) return auth.response

        const user = auth.user

        const { searchParams } =
            new URL(request.url)

        const page =
            Math.max(
                Number(searchParams.get('page') || 1),
                1
            )

        const limit =
            Math.min(
                Math.max(
                    Number(searchParams.get('limit') || 10),
                    1
                ),
                100
            )

        const offset =
            (page - 1) * limit

        const {
            whereSql,
            values,
        } = buildActivityWhere({
            user,
            searchParams,
        })

        const [countRows] = await db.execute(
            `
            SELECT
                COUNT(*) AS total
            FROM task_history th
            INNER JOIN task t
                ON t.task_id = th.task_id
            LEFT JOIN project p
                ON p.project_id = t.project_id
            LEFT JOIN \`user\` u
                ON u.id = th.action_by
            ${whereSql}
            `,
            values
        )

        const total =
            Number(countRows[0]?.total || 0)

        const safeLimit = Number.isFinite(limit)
            ? Number(limit)
            : 10

        const safeOffset = Number.isFinite(offset)
            ? Number(offset)
            : 0

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
        th.action_by,
        th.created_at,

        t.task_name,
        t.project_id,

        p.project_name,
        p.project_code,

        CONCAT(
            u.first_name_th,
            ' ',
            u.last_name_th
        ) AS action_by_name,
        u.picture_path AS action_by_picture

    FROM task_history th
    INNER JOIN task t
        ON t.task_id = th.task_id
    LEFT JOIN project p
        ON p.project_id = t.project_id
    LEFT JOIN \`user\` u
        ON u.id = th.action_by
    ${whereSql}
    ORDER BY th.created_at DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
    `,
            values
        )

        return NextResponse.json({
            success: true,
            activities: activityRows,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.max(
                    Math.ceil(total / limit),
                    1
                ),
            },
        })
    } catch (error) {
        console.error('Activity Log Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลด Activity Log ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
