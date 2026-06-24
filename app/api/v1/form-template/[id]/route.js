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
                form_template_id,
                form_name,
                form_code,
                description,
                paper_size,
                orientation,
                layout_json,
                status,
                created_by,
                updated_by,
                created_at,
                updated_at
            FROM form_template
            WHERE form_template_id = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [Number(id)]
        )

        const template = rows[0]

        if (!template) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบแบบฟอร์ม' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            template: {
                ...template,
                layout_json: safeJson(template.layout_json, {}),
            },
        })
    } catch (error) {
        console.error('Form Template Detail GET Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดแบบฟอร์มไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}

export async function PUT(request, context) {
    try {
        const auth = await requirePermission(request, 'form.update')
        if (auth.response) return auth.response

        const user = auth.user
        const { id } = await context.params
        const body = await request.json().catch(() => null)

        if (!body) {
            return NextResponse.json(
                { success: false, message: 'รูปแบบข้อมูลไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        const {
            form_name,
            form_code,
            description,
            orientation = 'portrait',
            layout_json,
            status = 'draft',
        } = body

        if (!form_name || !form_code || !layout_json) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
                { status: 400 }
            )
        }

        const [duplicateRows] = await db.execute(
            `
            SELECT form_template_id
            FROM form_template
            WHERE form_code = ?
            AND form_template_id <> ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [form_code, Number(id)]
        )

        if (duplicateRows.length > 0) {
            return NextResponse.json(
                { success: false, message: 'รหัสฟอร์มนี้ถูกใช้งานแล้ว' },
                { status: 409 }
            )
        }

        const [result] = await db.execute(
            `
            UPDATE form_template
            SET
                form_name = ?,
                form_code = ?,
                description = ?,
                orientation = ?,
                layout_json = ?,
                status = ?,
                updated_by = ?
            WHERE form_template_id = ?
            AND deleted_at IS NULL
            `,
            [
                form_name,
                form_code,
                description || null,
                orientation,
                JSON.stringify(layout_json),
                status,
                user.id,
                Number(id),
            ]
        )

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบแบบฟอร์มที่ต้องการแก้ไข' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'บันทึกแบบฟอร์มสำเร็จ',
        })
    } catch (error) {
        console.error('Form Template PUT Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'บันทึกแบบฟอร์มไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}

export async function DELETE(request, context) {
    try {
        const auth = await requirePermission(request, 'form.delete')
        if (auth.response) return auth.response

        const user = auth.user
        const { id } = await context.params

        const [result] = await db.execute(
            `
            UPDATE form_template
            SET
                deleted_at = CURRENT_TIMESTAMP,
                updated_by = ?
            WHERE form_template_id = ?
            AND deleted_at IS NULL
            `,
            [user.id, Number(id)]
        )

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบแบบฟอร์มที่ต้องการลบ' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'ลบแบบฟอร์มสำเร็จ',
        })
    } catch (error) {
        console.error('Form Template DELETE Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ลบแบบฟอร์มไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}