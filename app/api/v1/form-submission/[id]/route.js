import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { requirePermission } from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'
import { createFormDecisionNotification } from '@/app/lib/formNotify'
import { emitNotificationToUsers } from '@/app/lib/socketEmit'

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
                fs.template_version,
                fs.status,
                fs.submitted_by,
                fs.submitted_at,
                fs.decided_by,
                fs.decided_at,
                fs.decision_comment,

                COALESCE(fs.form_name_snapshot, ft.form_name) AS form_name,
                COALESCE(fs.form_code_snapshot, ft.form_code) AS form_code,
                COALESCE(fs.description_snapshot, ft.description) AS description,
                COALESCE(fs.layout_snapshot_json, ft.layout_json) AS layout_json,

                CONCAT(u.first_name_th, ' ', u.last_name_th) AS submitted_by_name,
                CONCAT(du.first_name_th, ' ', du.last_name_th) AS decided_by_name
            FROM form_submission fs
            INNER JOIN form_template ft
                ON ft.form_template_id = fs.form_template_id
            INNER JOIN \`user\` u
                ON u.id = fs.submitted_by
            LEFT JOIN \`user\` du
                ON du.id = fs.decided_by
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

        const [historyRows] = await db.execute(
            `
            SELECT
                h.history_id,
                h.from_status,
                h.to_status,
                h.action,
                h.comment,
                h.changed_by,
                h.created_at,
                CONCAT(u.first_name_th, ' ', u.last_name_th) AS changed_by_name
            FROM form_submission_history h
            LEFT JOIN \`user\` u
                ON u.id = h.changed_by
            WHERE h.form_submission_id = ?
            ORDER BY h.created_at ASC, h.history_id ASC
            `,
            [Number(id)]
        )

        return NextResponse.json({
            success: true,
            submission: {
                ...submission,
                data_json: safeJson(submission.data_json, {}),
                layout_json: safeJson(submission.layout_json, {}),
                history: historyRows,
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

export async function PATCH(request, context) {
    try {
        const auth = await requirePermission(request, 'form.approve')
        if (auth.response) return auth.response

        const user = auth.user
        const { id } = await context.params
        const submissionId = Number(id)
        const body = await request.json().catch(() => null)

        if (!submissionId) {
            return NextResponse.json(
                { success: false, message: 'form_submission_id ไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        if (!body) {
            return NextResponse.json(
                { success: false, message: 'รูปแบบข้อมูลไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        const action = String(body.action || '').trim()
        const comment = String(body.comment || '').trim()

        if (!['approve', 'reject'].includes(action)) {
            return NextResponse.json(
                { success: false, message: 'action ไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        if (action === 'reject' && !comment) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกเหตุผลการ Reject' },
                { status: 400 }
            )
        }

        const [rows] = await db.execute(
            `
            SELECT
                fs.form_submission_id,
                fs.form_template_id,
                fs.submission_no,
                fs.status,
                fs.submitted_by,
                COALESCE(fs.form_name_snapshot, ft.form_name) AS form_name
            FROM form_submission fs
            INNER JOIN form_template ft
                ON ft.form_template_id = fs.form_template_id
            WHERE fs.form_submission_id = ?
            AND fs.deleted_at IS NULL
            LIMIT 1
            `,
            [submissionId]
        )

        const submission = rows[0]

        if (!submission) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบเอกสาร' },
                { status: 404 }
            )
        }

        if (String(submission.submitted_by) === String(user.id)) {
            return NextResponse.json(
                { success: false, message: 'ไม่สามารถอนุมัติเอกสารของตัวเองได้' },
                { status: 403 }
            )
        }

        if (submission.status !== 'submitted') {
            return NextResponse.json(
                { success: false, message: 'เอกสารนี้ถูกตัดสินแล้ว' },
                { status: 409 }
            )
        }

        const nextStatus = action === 'approve'
            ? 'approved'
            : 'rejected'

        const [result] = await db.execute(
            `
            UPDATE form_submission
            SET
                status = ?,
                decided_by = ?,
                decided_at = CURRENT_TIMESTAMP,
                decision_comment = ?
            WHERE form_submission_id = ?
            AND status = 'submitted'
            AND deleted_at IS NULL
            `,
            [
                nextStatus,
                user.id,
                comment || null,
                submissionId,
            ]
        )

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: 'ไม่สามารถอัปเดตสถานะเอกสารได้' },
                { status: 409 }
            )
        }

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
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                submissionId,
                submission.status,
                nextStatus,
                action,
                comment || null,
                user.id,
            ]
        )

        await writeAuditLog({
            actorId: user.id,
            action: `form_submission.${action}`,
            entityType: 'form_submission',
            entityId: submissionId,
            summary: `${action} form submission ${submission.submission_no}`,
            metadata: {
                form_submission_id: submissionId,
                form_template_id: submission.form_template_id,
                submission_no: submission.submission_no,
                from_status: submission.status,
                to_status: nextStatus,
                comment: comment || null,
            },
        })

        const notificationTargetUserIds =
            await createFormDecisionNotification({
                formSubmissionId: submissionId,
                submissionNo: submission.submission_no,
                formName: submission.form_name,
                submitterId: submission.submitted_by,
                approverId: user.id,
                status: nextStatus,
                comment: comment || null,
            })

        await emitNotificationToUsers(notificationTargetUserIds)

        return NextResponse.json({
            success: true,
            message: action === 'approve'
                ? 'อนุมัติเอกสารสำเร็จ'
                : 'Reject เอกสารสำเร็จ',
            status: nextStatus,
        })
    } catch (error) {
        console.error('Form Submission PATCH Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'อัปเดตสถานะเอกสารไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
