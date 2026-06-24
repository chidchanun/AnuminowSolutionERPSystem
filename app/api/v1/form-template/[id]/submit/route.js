import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { requirePermission } from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'

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

function hasTextValue(value) {
    return value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
}

function getRequiredTableErrors(field, value) {
    const rows = Array.isArray(value) ? value : []
    const requiredColumns = Array.isArray(field.requiredColumns)
        ? field.requiredColumns.filter(Boolean)
        : []

    const filledRows = rows.filter((row) =>
        row &&
        Object.values(row).some((cell) => hasTextValue(cell))
    )

    if (field.required && filledRows.length === 0) {
        return [`${field.label || 'Table'} ต้องมีข้อมูลอย่างน้อย 1 แถว`]
    }

    if (requiredColumns.length === 0) {
        return []
    }

    const errors = []

    filledRows.forEach((row, index) => {
        requiredColumns.forEach((column) => {
            if (!hasTextValue(row?.[column])) {
                errors.push(
                    `${field.label || 'Table'} แถว ${index + 1} ต้องกรอก ${column}`
                )
            }
        })
    })

    return errors
}

function validateField(field, dataJson) {
    if (
        field.type === 'page_break' ||
        field.type === 'static_text'
    ) {
        return []
    }

    const value = dataJson[field.id]

    if (field.type === 'table') {
        return getRequiredTableErrors(field, value)
    }

    if (!field.required) {
        return []
    }

    if (field.type === 'checkbox') {
        return Array.isArray(value) && value.length > 0
            ? []
            : [`${field.label || 'Checkbox'} ต้องเลือกอย่างน้อย 1 ตัวเลือก`]
    }

    if (field.type === 'signature') {
        return hasTextValue(value)
            ? []
            : [`${field.label || 'Signature'} ต้องลงชื่อ`]
    }

    return hasTextValue(value)
        ? []
        : [field.label || 'Field']
}

export async function POST(request, context) {
    try {
        const auth = await requirePermission(request, 'form.fill')
        if (auth.response) return auth.response

        const user = auth.user
        const { id } = await context.params
        const templateId = Number(id)

        if (!templateId) {
            return NextResponse.json(
                { success: false, message: 'form_template_id ไม่ถูกต้อง' },
                { status: 400 }
            )
        }

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
                form_name,
                form_code,
                description,
                layout_json,
                version,
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

        const validationErrors = fields.flatMap((field) =>
            validateField(field, dataJson)
        )

        if (validationErrors.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: `กรุณากรอกข้อมูลให้ครบ: ${validationErrors.join(', ')}`,
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
                template_version,
                form_name_snapshot,
                form_code_snapshot,
                description_snapshot,
                layout_snapshot_json,
                status,
                submitted_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
            `,
            [
                templateId,
                submissionNo,
                JSON.stringify(dataJson),
                Number(template.version || 1),
                template.form_name,
                template.form_code,
                template.description || null,
                JSON.stringify(layout),
                user.id,
            ]
        )

        await db.execute(
            `
            INSERT INTO form_submission_history (
                form_submission_id,
                from_status,
                to_status,
                action,
                comment,
                changed_by
            )
            VALUES (?, NULL, 'submitted', 'submit', NULL, ?)
            `,
            [
                result.insertId,
                user.id,
            ]
        )

        await writeAuditLog({
            actorId: user.id,
            action: 'form_submission.create',
            entityType: 'form_submission',
            entityId: result.insertId,
            summary: `Submit form ${submissionNo}`,
            metadata: {
                form_submission_id: result.insertId,
                form_template_id: templateId,
                submission_no: submissionNo,
            },
        })

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
