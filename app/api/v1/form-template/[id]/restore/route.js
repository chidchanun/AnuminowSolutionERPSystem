import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { requirePermission } from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request, context) {
    try {
        const auth = await requirePermission(request, 'form.delete')
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
                form_code
            FROM form_template
            WHERE form_template_id = ?
            AND deleted_at IS NOT NULL
            LIMIT 1
            `,
            [templateId]
        )

        const template = rows[0]

        if (!template) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบแบบฟอร์มที่ถูก archive' },
                { status: 404 }
            )
        }

        const [duplicateRows] = await db.execute(
            `
            SELECT form_template_id
            FROM form_template
            WHERE form_code = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [template.form_code]
        )

        if (duplicateRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        'ไม่สามารถ restore ได้ เพราะรหัสฟอร์มนี้ถูกใช้งานอยู่',
                },
                { status: 409 }
            )
        }

        const [result] = await db.execute(
            `
            UPDATE form_template
            SET
                deleted_at = NULL,
                updated_by = ?
            WHERE form_template_id = ?
            AND deleted_at IS NOT NULL
            `,
            [user.id, templateId]
        )

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: 'Restore form template failed' },
                { status: 409 }
            )
        }

        await writeAuditLog({
            actorId: user.id,
            action: 'form_template.restore',
            entityType: 'form_template',
            entityId: templateId,
            summary: `Restore form template ${template.form_name}`,
            metadata: {
                form_template_id: templateId,
                form_name: template.form_name,
                form_code: template.form_code,
            },
        })

        return NextResponse.json({
            success: true,
            message: 'Restore form template success',
        })
    } catch (error) {
        console.error('Form Template Restore Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Restore form template failed',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
