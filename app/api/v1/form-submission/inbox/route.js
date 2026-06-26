import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { hasPermissionKey, requirePermission } from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseBoundedInt(value, fallback, min, max) {
    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
        return fallback
    }

    return Math.min(Math.max(Math.trunc(parsed), min), max)
}

function buildInboxWhere(searchParams, user) {
    const scope = searchParams.get('scope') || 'pending_approval'
    const where = ['fs.deleted_at IS NULL']
    const values = []

    if (scope === 'my_submissions') {
        where.push('fs.submitted_by = ?')
        values.push(user.id)
    } else if (scope === 'decided') {
        where.push("fs.status IN ('approved', 'rejected')")
    } else {
        if (!hasPermissionKey(user, 'form.approve')) {
            where.push('1 = 0')
        } else {
            where.push("fs.status = 'submitted'")
            where.push('fs.submitted_by <> ?')
            values.push(user.id)
        }
    }

    const status = (searchParams.get('status') || '').trim()
    if (
        status &&
        status !== 'all' &&
        ['submitted', 'approved', 'rejected', 'cancelled'].includes(status)
    ) {
        where.push('fs.status = ?')
        values.push(status)
    }

    const search = (searchParams.get('search') || '').trim()
    if (search) {
        where.push(`
            (
                fs.submission_no LIKE ?
                OR COALESCE(fs.form_name_snapshot, ft.form_name) LIKE ?
                OR COALESCE(fs.form_code_snapshot, ft.form_code) LIKE ?
                OR fs.submitted_by LIKE ?
                OR CONCAT(su.first_name_th, ' ', su.last_name_th) LIKE ?
            )
        `)

        const keyword = `%${search}%`
        values.push(keyword, keyword, keyword, keyword, keyword)
    }

    return {
        scope,
        whereSql: where.join(' AND '),
        values,
    }
}

export async function GET(request) {
    try {
        const auth = await requirePermission(request, 'form.view')
        if (auth.response) return auth.response

        const user = auth.user
        const { searchParams } = new URL(request.url)
        const page = parseBoundedInt(
            searchParams.get('page'),
            1,
            1,
            Number.MAX_SAFE_INTEGER
        )
        const limit = parseBoundedInt(
            searchParams.get('limit'),
            20,
            1,
            100
        )
        const offset = (page - 1) * limit
        const { scope, whereSql, values } = buildInboxWhere(searchParams, user)

        const [countRows] = await db.execute(
            `
            SELECT COUNT(*) AS total
            FROM form_submission fs
            INNER JOIN form_template ft
                ON ft.form_template_id = fs.form_template_id
            INNER JOIN \`user\` su
                ON su.id = fs.submitted_by
            LEFT JOIN \`user\` du
                ON du.id = fs.decided_by
            WHERE ${whereSql}
            `,
            values
        )

        const total = Number(countRows[0]?.total || 0)

        const [rows] = await db.execute(
            `
            SELECT
                fs.form_submission_id,
                fs.form_template_id,
                fs.submission_no,
                fs.template_version,
                fs.status,
                fs.submitted_by,
                fs.submitted_at,
                fs.decided_by,
                fs.decided_at,
                fs.decision_comment,
                COALESCE(fs.form_name_snapshot, ft.form_name) AS form_name,
                COALESCE(fs.form_code_snapshot, ft.form_code) AS form_code,
                CONCAT(su.first_name_th, ' ', su.last_name_th) AS submitted_by_name,
                CONCAT(du.first_name_th, ' ', du.last_name_th) AS decided_by_name
            FROM form_submission fs
            INNER JOIN form_template ft
                ON ft.form_template_id = fs.form_template_id
            INNER JOIN \`user\` su
                ON su.id = fs.submitted_by
            LEFT JOIN \`user\` du
                ON du.id = fs.decided_by
            WHERE ${whereSql}
            ORDER BY
                CASE
                    WHEN fs.status = 'submitted' THEN fs.submitted_at
                    ELSE COALESCE(fs.decided_at, fs.submitted_at)
                END DESC
            LIMIT ${limit}
            OFFSET ${offset}
            `,
            values
        )

        return NextResponse.json({
            success: true,
            scope,
            submissions: rows,
            can_approve: hasPermissionKey(user, 'form.approve'),
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error('Form Submission Inbox GET Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Load form inbox failed',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
