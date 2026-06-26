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

function createCopyCode(baseCode, suffix) {
    const base = String(baseCode || 'FORM')
        .replace(/-COPY(?:-\d+)?$/i, '')
        .slice(0, 68)

    return suffix === 1
        ? `${base}-COPY`
        : `${base}-COPY-${suffix}`
}

export async function POST(request, context) {
    try {
        const auth = await requirePermission(request, 'form.create')
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

        const [rows] = await db.execute(
            `
            SELECT
                form_template_id,
                form_name,
                form_code,
                description,
                paper_size,
                orientation,
                layout_json
            FROM form_template
            WHERE form_template_id = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [templateId]
        )

        const template = rows[0]

        if (!template) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบแบบฟอร์ม' },
                { status: 404 }
            )
        }

        let copyCode = null

        for (let suffix = 1; suffix <= 50; suffix += 1) {
            const candidate = createCopyCode(template.form_code, suffix)
            const [exists] = await db.execute(
                `
                SELECT form_template_id
                FROM form_template
                WHERE form_code = ?
                AND deleted_at IS NULL
                LIMIT 1
                `,
                [candidate]
            )

            if (exists.length === 0) {
                copyCode = candidate
                break
            }
        }

        if (!copyCode) {
            return NextResponse.json(
                { success: false, message: 'ไม่สามารถสร้างรหัสสำเนาที่ไม่ซ้ำได้' },
                { status: 409 }
            )
        }

        const layout = safeJson(template.layout_json, {})
        const copyName = `${template.form_name} Copy`

        const [result] = await db.execute(
            `
            INSERT INTO form_template (
                form_name,
                form_code,
                description,
                paper_size,
                orientation,
                layout_json,
                status,
                created_by,
                updated_by
            )
            VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)
            `,
            [
                copyName,
                copyCode,
                template.description || null,
                template.paper_size || 'A4',
                template.orientation || 'portrait',
                JSON.stringify(layout),
                user.id,
                user.id,
            ]
        )

        await writeAuditLog({
            actorId: user.id,
            action: 'form_template.duplicate',
            entityType: 'form_template',
            entityId: result.insertId,
            summary: `Duplicate form template ${template.form_name}`,
            metadata: {
                source_form_template_id: templateId,
                form_template_id: result.insertId,
                form_name: copyName,
                form_code: copyCode,
            },
        })

        return NextResponse.json(
            {
                success: true,
                message: 'Duplicate form template success',
                form_template_id: result.insertId,
                form_code: copyCode,
            },
            { status: 201 }
        )
    } catch (error) {
        console.error('Form Template Duplicate Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Duplicate form template failed',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
