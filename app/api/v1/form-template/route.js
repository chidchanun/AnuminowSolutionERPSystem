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

export async function GET(request) {
    try {
        const auth = await requirePermission(request, 'form.view')
        if (auth.response) return auth.response

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || 'all'

        const values = []
        const where = []

        if (status === 'archived') {
            where.push('deleted_at IS NOT NULL')
        } else {
            where.push('deleted_at IS NULL')
        }

        if (status !== 'all' && ['draft', 'active', 'inactive'].includes(status)) {
            where.push('status = ?')
            values.push(status)
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
                layout_json,
                version,
                status,
                created_by,
                updated_by,
                created_at,
                updated_at,
                deleted_at
            FROM form_template
            WHERE ${where.join(' AND ')}
            ORDER BY created_at DESC
            `,
            values
        )

        return NextResponse.json({
            success: true,
            templates: rows.map((row) => ({
                ...row,
                layout_json: safeJson(row.layout_json, {}),
            })),
        })
    } catch (error) {
        console.error('Form Template GET Error:', error)

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

export async function POST(request) {
    try {
        const auth = await requirePermission(request, 'form.create')
        if (auth.response) return auth.response

        const user = auth.user
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
                { success: false, message: 'กรุณากรอกชื่อฟอร์ม รหัสฟอร์ม และ layout' },
                { status: 400 }
            )
        }

        if (!['portrait', 'landscape'].includes(orientation)) {
            return NextResponse.json(
                { success: false, message: 'orientation ไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        if (!['draft', 'active', 'inactive'].includes(status)) {
            return NextResponse.json(
                { success: false, message: 'status ไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        const [exists] = await db.execute(
            `
            SELECT form_template_id
            FROM form_template
            WHERE form_code = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [form_code]
        )

        if (exists.length > 0) {
            return NextResponse.json(
                { success: false, message: 'รหัสฟอร์มนี้ถูกใช้งานแล้ว' },
                { status: 409 }
            )
        }

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
            VALUES (?, ?, ?, 'A4', ?, ?, ?, ?, ?)
            `,
            [
                form_name,
                form_code,
                description || null,
                orientation,
                JSON.stringify(layout_json),
                status,
                user.id,
                user.id,
            ]
        )

        await writeAuditLog({
            actorId: user.id,
            action: 'form_template.create',
            entityType: 'form_template',
            entityId: result.insertId,
            summary: `Create form template ${form_name}`,
            metadata: {
                form_template_id: result.insertId,
                form_name,
                form_code,
                status,
                orientation,
                field_count: Array.isArray(layout_json?.fields)
                    ? layout_json.fields.length
                    : 0,
            },
        })

        return NextResponse.json(
            {
                success: true,
                message: 'สร้างแบบฟอร์มสำเร็จ',
                form_template_id: result.insertId,
            },
            { status: 201 }
        )
    } catch (error) {
        console.error('Form Template POST Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'สร้างแบบฟอร์มไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
