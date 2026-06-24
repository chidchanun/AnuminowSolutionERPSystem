import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { requirePermission } from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const auth = await requirePermission(request, 'form.view')
        if (auth.response) return auth.response

        const [rows] = await db.execute(
            `
            SELECT
                fs.form_submission_id,
                fs.form_template_id,
                fs.submission_no,
                fs.status,
                fs.submitted_by,
                fs.submitted_at,
                ft.form_name,
                ft.form_code,
                CONCAT(u.first_name_th, ' ', u.last_name_th) AS submitted_by_name
            FROM form_submission fs
            INNER JOIN form_template ft
                ON ft.form_template_id = fs.form_template_id
            INNER JOIN \`user\` u
                ON u.id = fs.submitted_by
            WHERE fs.deleted_at IS NULL
            ORDER BY fs.submitted_at DESC
            LIMIT 200
            `
        )

        return NextResponse.json({
            success: true,
            submissions: rows,
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