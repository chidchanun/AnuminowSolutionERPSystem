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

function createSubmissionNo(templateId) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const time = String(now.getTime()).slice(-6)

    return `FORM-${templateId}-${y}${m}${d}-${time}`
}

export async function POST(request, context) {
    try {
        const auth = await requirePermission(request, 'form.fill')
        if (auth.response) return auth.response

        const user = auth.user
        const { id } = await context.params
        const templateId = Number(id)

        const body = await request.json().catch(() => null)

        if (!body) {
            return NextResponse.json(
                { success: false, message: 'รูปแบบข้อมูลไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        const [templateRows] = await db.execute(
            `
            SELECT
                form_template_id,
                layout_json,
                status
            FROM form_template
            WHERE form_template_id = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [templateId]
        )

        const template = templateRows[0]

        if (!template) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบแบบฟอร์ม' },
                { status: 404 }
            )
        }

        if (template.status !== 'active') {
            return NextResponse.json(
                { success: false, message: 'แบบฟอร์มนี้ยังไม่เปิดใช้งาน' },
                { status: 400 }
            )
        }

        const layout = safeJson(template.layout_json, {})
        const fields = Array.isArray(layout.fields) ? layout.fields : []
        const dataJson = body.data_json || {}

        const missingFields = fields
            .filter((field) => field.type !== 'page_break')
            .filter((field) => field.required)
            .filter((field) => {
                const value = dataJson[field.id]

                if (field.type === 'table') {
                    return false
                }

                return value === undefined || value === null || String(value).trim() === ''
            })


        if (missingFields.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: `กรุณากรอกข้อมูลให้ครบ: ${missingFields.map((f) => f.label).join(', ')}`,
                },
                { status: 400 }
            )
        }

        const submissionNo = createSubmissionNo(templateId)

        const [result] = await db.execute(
            `
            INSERT INTO form_submission (
                form_template_id,
                submission_no,
                data_json,
                status,
                submitted_by
            )
            VALUES (?, ?, ?, 'submitted', ?)
            `,
            [
                templateId,
                submissionNo,
                JSON.stringify(dataJson),
                user.id,
            ]
        )

        return NextResponse.json(
            {
                success: true,
                message: 'ส่งแบบฟอร์มสำเร็จ',
                form_submission_id: result.insertId,
                submission_no: submissionNo,
            },
            { status: 201 }
        )
    } catch (error) {
        console.error('Form Submit Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ส่งแบบฟอร์มไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}