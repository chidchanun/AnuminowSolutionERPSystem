import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export const dynamic = 'force-dynamic'

const validStatus = [
    'all',
    'planning',
    'active',
    'completed',
    'cancelled',
]

const sortMap = {
    updated: 'p.updated_at DESC',
    newest: 'p.created_at DESC',
    start_asc: 'p.start_date IS NULL, p.start_date ASC',
    end_asc: 'p.end_date IS NULL, p.end_date ASC',
    name: 'p.project_name ASC',
}

function buildWhere({
    userId,
    filters,
}) {
    const where = [
        'p.deleted_at IS NULL',
        `
        (
            p.created_by = ?
            OR EXISTS (
                SELECT 1
                FROM project_member pm_scope
                WHERE pm_scope.project_id = p.project_id
                AND pm_scope.user_id = ?
            )
        )
        `,
    ]

    const values = [
        userId,
        userId,
    ]

    if (filters.q) {
        where.push(`
            (
                p.project_name LIKE ?
                OR p.project_code LIKE ?
                OR p.description LIKE ?
            )
        `)

        const keyword = `%${filters.q}%`

        values.push(
            keyword,
            keyword,
            keyword
        )
    }

    if (
        filters.status !== 'all' &&
        validStatus.includes(filters.status)
    ) {
        where.push('p.status = ?')
        values.push(filters.status)
    }

    return {
        whereSql: `WHERE ${where.join(' AND ')}`,
        values,
    }
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

        const { searchParams } =
            new URL(request.url)

        const pageRaw =
            Number(searchParams.get('page')) || 1

        const limitRaw =
            Number(searchParams.get('limit')) || 10

        const page =
            Math.max(pageRaw, 1)

        const limit =
            Math.min(Math.max(limitRaw, 1), 50)

        const offset =
            (page - 1) * limit

        const filters = {
            q: (searchParams.get('q') || '').trim(),
            status:
                searchParams.get('status') || 'all',
        }

        const sort =
            searchParams.get('sort') || 'updated'

        const orderBy =
            sortMap[sort] || sortMap.updated

        const taskWhere = buildWhere({
            userId,
            filters,
        })

        const [summaryRows] = await db.execute(
            `
            SELECT
                COUNT(*) AS total_projects,

                COALESCE(SUM(
                    CASE
                        WHEN p.status = 'planning'
                        THEN 1 ELSE 0
                    END
                ), 0) AS planning_projects,

                COALESCE(SUM(
                    CASE
                        WHEN p.status = 'active'
                        THEN 1 ELSE 0
                    END
                ), 0) AS active_projects,

                COALESCE(SUM(
                    CASE
                        WHEN p.status = 'completed'
                        THEN 1 ELSE 0
                    END
                ), 0) AS completed_projects,

                COALESCE(SUM(
                    CASE
                        WHEN p.status = 'cancelled'
                        THEN 1 ELSE 0
                    END
                ), 0) AS cancelled_projects

            FROM project p
            WHERE p.deleted_at IS NULL
            AND (
                p.created_by = ?
                OR EXISTS (
                    SELECT 1
                    FROM project_member pm_scope
                    WHERE pm_scope.project_id = p.project_id
                    AND pm_scope.user_id = ?
                )
            )
            `,
            [
                userId,
                userId,
            ]
        )

        const [countRows] = await db.execute(
            `
            SELECT COUNT(*) AS total
            FROM project p
            ${taskWhere.whereSql}
            `,
            taskWhere.values
        )

        const total =
            countRows[0]?.total || 0

        const totalPages =
            Math.max(Math.ceil(total / limit), 1)

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

                CASE
                    WHEN p.created_by = ?
                    THEN 1 ELSE 0
                END AS is_owner,

                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM project_member pm_me
                        WHERE pm_me.project_id = p.project_id
                        AND pm_me.user_id = ?
                    )
                    THEN 1 ELSE 0
                END AS is_member,

                (
                    SELECT COUNT(*)
                    FROM project_member pm_count
                    WHERE pm_count.project_id = p.project_id
                ) AS member_count,

                (
                    SELECT COUNT(*)
                    FROM task t
                    WHERE t.project_id = p.project_id
                    AND t.deleted_at IS NULL
                ) AS task_count,

                (
                    SELECT COUNT(*)
                    FROM task t
                    WHERE t.project_id = p.project_id
                    AND t.status = 'done'
                    AND t.deleted_at IS NULL
                ) AS done_task_count

            FROM project p
            INNER JOIN \`user\` u
                ON p.created_by = u.id
            ${taskWhere.whereSql}
            ORDER BY ${orderBy}
            LIMIT ${limit} OFFSET ${offset}
            `,
            [
                userId,
                userId,
                ...taskWhere.values,
            ]
        )

        return NextResponse.json({
            success: true,
            projects: projectRows,
            summary: {
                total_projects:
                    summaryRows[0]?.total_projects || 0,
                planning_projects:
                    summaryRows[0]?.planning_projects || 0,
                active_projects:
                    summaryRows[0]?.active_projects || 0,
                completed_projects:
                    summaryRows[0]?.completed_projects || 0,
                cancelled_projects:
                    summaryRows[0]?.cancelled_projects || 0,
            },
            filters,
            pagination: {
                page,
                limit,
                total,
                total_pages: totalPages,
            },
        })
    } catch (error) {
        console.error('Get my projects error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ไม่สามารถโหลดโปรเจกต์ของฉันได้',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}