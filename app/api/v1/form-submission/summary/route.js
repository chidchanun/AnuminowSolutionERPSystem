import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { requirePermission } from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toNumber(value) {
    return Number(value || 0)
}

function csvCell(value) {
    const text = String(value ?? '')

    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`
    }

    return text
}

function toCsv(rows) {
    return rows
        .map((row) => row.map(csvCell).join(','))
        .join('\n')
}

function createCsv(summary, pendingSubmissions) {
    const rows = [
        ['metric', 'value'],
        ['total_submissions', summary.total_submissions],
        ['submitted', summary.submitted],
        ['approved', summary.approved],
        ['rejected', summary.rejected],
        ['cancelled', summary.cancelled],
        ['today_submissions', summary.today_submissions],
        ['active_templates', summary.active_templates],
        [],
        [
            'pending_submission_no',
            'form_code',
            'form_name',
            'submitted_by',
            'submitted_at',
        ],
        ...pendingSubmissions.map((item) => [
            item.submission_no,
            item.form_code,
            item.form_name,
            item.submitted_by_name || item.submitted_by,
            item.submitted_at,
        ]),
    ]

    return `\uFEFF${toCsv(rows)}`
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const format = (searchParams.get('format') || 'json').toLowerCase()
        const isCsv = format === 'csv'
        const auth = await requirePermission(
            request,
            isCsv ? 'form.export' : 'form.view'
        )

        if (auth.response) return auth.response

        const user = auth.user

        const [summaryRows] = await db.execute(
            `
            SELECT
                COUNT(*) AS total_submissions,
                SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
                SUM(CASE WHEN DATE(submitted_at) = CURRENT_DATE() THEN 1 ELSE 0 END) AS today_submissions
            FROM form_submission
            WHERE deleted_at IS NULL
            `
        )

        const [templateRows] = await db.execute(
            `
            SELECT
                COUNT(*) AS total_templates,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_templates
            FROM form_template
            WHERE deleted_at IS NULL
            `
        )

        const [pendingRows] = await db.execute(
            `
            SELECT
                fs.form_submission_id,
                fs.form_template_id,
                fs.submission_no,
                fs.template_version,
                fs.status,
                fs.submitted_by,
                fs.submitted_at,
                COALESCE(fs.form_name_snapshot, ft.form_name) AS form_name,
                COALESCE(fs.form_code_snapshot, ft.form_code) AS form_code,
                CONCAT(u.first_name_th, ' ', u.last_name_th) AS submitted_by_name
            FROM form_submission fs
            INNER JOIN form_template ft
                ON ft.form_template_id = fs.form_template_id
            INNER JOIN \`user\` u
                ON u.id = fs.submitted_by
            WHERE fs.deleted_at IS NULL
            AND fs.status = 'submitted'
            ORDER BY fs.submitted_at ASC
            LIMIT 10
            `
        )

        const rawSummary = summaryRows[0] || {}
        const rawTemplateSummary = templateRows[0] || {}
        const summary = {
            total_submissions: toNumber(rawSummary.total_submissions),
            submitted: toNumber(rawSummary.submitted),
            approved: toNumber(rawSummary.approved),
            rejected: toNumber(rawSummary.rejected),
            cancelled: toNumber(rawSummary.cancelled),
            today_submissions: toNumber(rawSummary.today_submissions),
            total_templates: toNumber(rawTemplateSummary.total_templates),
            active_templates: toNumber(rawTemplateSummary.active_templates),
        }

        if (isCsv) {
            await writeAuditLog({
                actorId: user.id,
                action: 'form_submission.export_summary',
                entityType: 'form_submission',
                entityId: null,
                summary: 'Export form submission summary',
                metadata: {
                    total_submissions: summary.total_submissions,
                    pending_submissions: summary.submitted,
                },
            })

            return new NextResponse(createCsv(summary, pendingRows), {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="form-summary.csv"',
                    'Cache-Control': 'no-store',
                },
            })
        }

        return NextResponse.json({
            success: true,
            summary,
            pending_submissions: pendingRows,
        })
    } catch (error) {
        console.error('Form Submission Summary GET Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดรายงานฟอร์มไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
