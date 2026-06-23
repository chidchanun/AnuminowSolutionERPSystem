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

    const canViewAll = hasTaskWideAccess(user)
    const canViewRelated = hasTaskRelatedAccess(user)

    if (!canViewAll && canViewRelated) {
        where.push(`
            (
                t.created_by = ?
                OR p.created_by = ?
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

        values.push(user.id, user.id, user.id, user.id)
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

        values.push(user.id)
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
            'activity.view'
        )

        if (auth.response) return auth.response

        const user = auth.user

        const scope = buildTaskScope(user)

        const [projectRows] = await db.execute(
            `
            SELECT DISTINCT
                p.project_id,
                p.project_name,
                p.project_code
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
            WHERE ${scope.whereSql}
            ORDER BY p.project_name ASC
            LIMIT 300
            `,
            scope.values
        )

        const [taskRows] = await db.execute(
            `
            SELECT
                t.task_id,
                t.task_name,
                t.project_id,
                p.project_name,
                p.project_code
            FROM task t
            INNER JOIN project p
                ON p.project_id = t.project_id
            WHERE ${scope.whereSql}
            ORDER BY t.updated_at DESC
            LIMIT 500
            `,
            scope.values
        )

        const [userRows] = await db.execute(
            `
            SELECT DISTINCT
                u.id,
                CONCAT(
                    u.first_name_th,
                    ' ',
                    u.last_name_th
                ) AS full_name,
                u.picture_path,
                r.role_name,
                d.department_name
            FROM task_history th
            INNER JOIN task t
                ON t.task_id = th.task_id
            INNER JOIN project p
                ON p.project_id = t.project_id
            INNER JOIN \`user\` u
                ON u.id = th.action_by
            LEFT JOIN role r
                ON r.role_id = u.role_id
            LEFT JOIN department d
                ON d.department_id = u.department_id
            WHERE ${scope.whereSql}
            ORDER BY full_name ASC
            LIMIT 300
            `,
            scope.values
        )

        return NextResponse.json({
            success: true,
            projects: projectRows,
            tasks: taskRows,
            users: userRows,
        })
    } catch (error) {
        console.error('Activity filter options error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดตัวเลือกตัวกรองไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
