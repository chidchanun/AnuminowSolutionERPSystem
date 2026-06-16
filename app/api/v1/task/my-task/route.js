import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

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
    'today',
    'next7',
    'next30',
    'no_due',
]

const sortMap = {
    updated: 't.updated_at DESC',
    newest: 't.created_at DESC',
    due_asc: 't.due_date IS NULL, t.due_date ASC',
    due_desc: 't.due_date IS NULL, t.due_date DESC',
    priority: `
        CASE t.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
        END ASC
    `,
}

function buildWhere({ userId, filters }) {
    const where = [
        'ta.user_id = ?',
        't.deleted_at IS NULL',
        'p.deleted_at IS NULL',
    ]

    const values = [userId]

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
        filters.status !== 'all' &&
        validStatus.includes(filters.status)
    ) {
        where.push('t.status = ?')
        values.push(filters.status)
    }

    if (
        filters.priority !== 'all' &&
        validPriority.includes(filters.priority)
    ) {
        where.push('t.priority = ?')
        values.push(filters.priority)
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
            project_id:
                searchParams.get('project_id') || 'all',
            status:
                searchParams.get('status') || 'all',
            priority:
                searchParams.get('priority') || 'all',
            due:
                searchParams.get('due') || 'all',
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
                COUNT(t.task_id) AS total_tasks,

                COALESCE(SUM(
                    CASE
                        WHEN t.status = 'todo'
                        THEN 1 ELSE 0
                    END
                ), 0) AS todo_tasks,

                COALESCE(SUM(
                    CASE
                        WHEN t.status = 'in_progress'
                        THEN 1 ELSE 0
                    END
                ), 0) AS in_progress_tasks,

                COALESCE(SUM(
                    CASE
                        WHEN t.status = 'review'
                        THEN 1 ELSE 0
                    END
                ), 0) AS review_tasks,

                COALESCE(SUM(
                    CASE
                        WHEN t.status = 'done'
                        THEN 1 ELSE 0
                    END
                ), 0) AS done_tasks,

                COALESCE(SUM(
                    CASE
                        WHEN t.status != 'done'
                        AND t.due_date IS NOT NULL
                        AND t.due_date < CURDATE()
                        THEN 1 ELSE 0
                    END
                ), 0) AS overdue_tasks

            FROM task_assignment ta
            INNER JOIN task t
                ON ta.task_id = t.task_id
            INNER JOIN project p
                ON t.project_id = p.project_id
            ${taskWhere.whereSql}
            `,
            taskWhere.values
        )

        const [countRows] = await db.execute(
            `
            SELECT COUNT(*) AS total
            FROM task_assignment ta
            INNER JOIN task t
                ON ta.task_id = t.task_id
            INNER JOIN project p
                ON t.project_id = p.project_id
            ${taskWhere.whereSql}
            `,
            taskWhere.values
        )

        const total =
            countRows[0]?.total || 0

        const totalPages =
            Math.max(Math.ceil(total / limit), 1)

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

                CONCAT(
                    creator.first_name_th,
                    ' ',
                    creator.last_name_th
                ) AS created_by_name

            FROM task_assignment ta
            INNER JOIN task t
                ON ta.task_id = t.task_id
            INNER JOIN project p
                ON t.project_id = p.project_id
            INNER JOIN \`user\` creator
                ON t.created_by = creator.id
            ${taskWhere.whereSql}
            ORDER BY ${orderBy}
            LIMIT ${limit} OFFSET ${offset}
            `,
            taskWhere.values
        )

        const [projectRows] = await db.execute(
            `
            SELECT DISTINCT
                p.project_id,
                p.project_name
            FROM task_assignment ta
            INNER JOIN task t
                ON ta.task_id = t.task_id
            INNER JOIN project p
                ON t.project_id = p.project_id
            WHERE ta.user_id = ?
            AND t.deleted_at IS NULL
            AND p.deleted_at IS NULL
            ORDER BY p.project_name ASC
            `,
            [userId]
        )

        return NextResponse.json({
            success: true,
            tasks: taskRows,
            summary: {
                total_tasks:
                    summaryRows[0]?.total_tasks || 0,
                todo_tasks:
                    summaryRows[0]?.todo_tasks || 0,
                in_progress_tasks:
                    summaryRows[0]?.in_progress_tasks || 0,
                review_tasks:
                    summaryRows[0]?.review_tasks || 0,
                done_tasks:
                    summaryRows[0]?.done_tasks || 0,
                overdue_tasks:
                    summaryRows[0]?.overdue_tasks || 0,
            },
            options: {
                projects: projectRows,
            },
            pagination: {
                page,
                limit,
                total,
                total_pages: totalPages,
            },
            filters,
        })
    } catch (error) {
        console.error('Get my tasks error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ไม่สามารถโหลดข้อมูลงานของฉันได้',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}