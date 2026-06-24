import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { requirePermission } from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseBoundedInt(value, fallback, min, max) {
    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
        return fallback
    }

    return Math.min(Math.max(Math.trunc(parsed), min), max)
}

function buildSubmissionWhere(searchParams) {
    const where = ['fs.deleted_at IS NULL']
    const values = []

    const status = (searchParams.get('status') || '').trim()
    if (status && status !== 'all') {
        where.push('fs.status = ?')
        values.push(status)
    }

    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''

    if (from && to) {
        where.push('DATE(fs.submitted_at) BETWEEN ? AND ?')
        values.push(from, to)
    } else if (from) {
        where.push('DATE(fs.submitted_at) >= ?')
        values.push(from)
    } else if (to) {
        where.push('DATE(fs.submitted_at) <= ?')
        values.push(to)
    }

    const search = (searchParams.get('search') || '').trim()
    if (search) {
        where.push(`
            (
                fs.submission_no LIKE ?
                OR COALESCE(fs.form_name_snapshot, ft.form_name) LIKE ?
                OR COALESCE(fs.form_code_snapshot, ft.form_code) LIKE ?
                OR fs.submitted_by LIKE ?
                OR CONCAT(u.first_name_th, ' ', u.last_name_th) LIKE ?
            )
        `)

        const keyword = `%${search}%`
        values.push(keyword, keyword, keyword, keyword, keyword)
    }

    return {
        whereSql: where.join(' AND '),
        values,
    }
}

export async function GET(request) {
    try {
        const auth = await requirePermission(request, 'form.view')
        if (auth.response) return auth.response

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
        const { whereSql, values } = buildSubmissionWhere(searchParams)

        const [countRows] = await db.execute(
            `
            SELECT COUNT(*) AS total
            FROM form_submission fs
            INNER JOIN form_template ft
                ON ft.form_template_id = fs.form_template_id
            INNER JOIN \`user\` u
                ON u.id = fs.submitted_by
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
                COALESCE(fs.form_name_snapshot, ft.form_name) AS form_name,
                COALESCE(fs.form_code_snapshot, ft.form_code) AS form_code,
                CONCAT(u.first_name_th, ' ', u.last_name_th) AS submitted_by_name
            FROM form_submission fs
            INNER JOIN form_template ft
                ON ft.form_template_id = fs.form_template_id
            INNER JOIN \`user\` u
                ON u.id = fs.submitted_by
            WHERE ${whereSql}
            ORDER BY fs.submitted_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
            `,
            values
        )

        return NextResponse.json({
            success: true,
            submissions: rows,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error('Form Submission List GET Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดรายการเอกสารไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
