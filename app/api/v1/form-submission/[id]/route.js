import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { requirePermission } from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeJson(value, fallback = {}) {
    if (!value) return fallback
    if (typeof value === 'object') return value

    try {
        return JSON.parse(value)
    } catch {
        return fallback
    }
}

export async function GET(request, context) {
    try {
        const auth = await requirePermission(request, 'form.view')
        if (auth.response) return auth.response

        const { id } = await context.params

        const [rows] = await db.execute(
            `
            SELECT
                fs.form_submission_id,
                fs.form_template_id,
                fs.submission_no,
                fs.data_json,
                fs.status,
                fs.submitted_by,
                fs.submitted_at,

                ft.form_name,
                ft.form_code,
                ft.layout_json,

                CONCAT(u.first_name_th, ' ', u.last_name_th) AS submitted_by_name
            FROM form_submission fs
            INNER JOIN form_template ft
                ON ft.form_template_id = fs.form_template_id
            INNER JOIN \`user\` u
                ON u.id = fs.submitted_by
            WHERE fs.form_submission_id = ?
            AND fs.deleted_at IS NULL
            LIMIT 1
            `,
            [Number(id)]
        )

        const submission = rows[0]

        if (!submission) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบเอกสาร' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            submission: {
                ...submission,
                data_json: safeJson(submission.data_json, {}),
                layout_json: safeJson(submission.layout_json, {}),
            },
        })
    } catch (error) {
        console.error('Form Submission GET Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดเอกสารไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}