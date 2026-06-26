import { db } from '@/app/lib/db'
import { createNotifications } from '@/app/lib/notification'

export async function getFormApproverUserIds(
    connection = db,
    excludeUserId = null
) {
    const values = []
    let excludeSql = ''

    if (excludeUserId) {
        excludeSql = 'AND u.id <> ?'
        values.push(excludeUserId)
    }

    const [rows] = await connection.execute(
        `
        SELECT DISTINCT
            u.id
        FROM \`user\` u
        INNER JOIN permission_role_map prm
            ON prm.permission_role_id = u.permission_role_id
        INNER JOIN permission p
            ON p.permission_id = prm.permission_id
        WHERE u.deleted_at IS NULL
        AND u.status = 'active'
        AND p.permission_key = 'form.approve'
        ${excludeSql}
        `,
        values
    )

    return rows.map((row) => row.id)
}

export async function getUserFullName(
    connection = db,
    userId
) {
    const [rows] = await connection.execute(
        `
        SELECT
            CONCAT(first_name_th, ' ', last_name_th) AS full_name
        FROM \`user\`
        WHERE id = ?
        LIMIT 1
        `,
        [userId]
    )

    return rows[0]?.full_name || userId
}

export async function createFormSubmittedNotifications({
    connection = db,
    formSubmissionId,
    submissionNo,
    formName,
    submitterId,
    createdBy,
}) {
    const approverUserIds =
        await getFormApproverUserIds(connection, submitterId)

    if (approverUserIds.length === 0) {
        return []
    }

    const submitterName =
        await getUserFullName(connection, submitterId)

    await createNotifications({
        connection,
        userIds: approverUserIds,
        type: 'form_approval',
        title: 'New form approval request',
        message:
            `${submitterName} submitted ${formName || 'a form'} ` +
            `(${submissionNo})`,
        link: `/dashboard/form/submission/${formSubmissionId}`,
        sourceTable: 'form_submission',
        sourceId: formSubmissionId,
        createdBy,
        uniqueKeyPrefix: `form_submission:${formSubmissionId}:approval`,
    })

    return approverUserIds
}

export async function createFormDecisionNotification({
    connection = db,
    formSubmissionId,
    submissionNo,
    formName,
    submitterId,
    approverId,
    status,
    comment = null,
}) {
    if (!submitterId) {
        return []
    }

    const isApproved = status === 'approved'
    const approverName =
        await getUserFullName(connection, approverId)

    await createNotifications({
        connection,
        userIds: [submitterId],
        type: isApproved ? 'form_approved' : 'form_rejected',
        title: isApproved
            ? 'Form submission approved'
            : 'Form submission rejected',
        message:
            `${formName || 'Form'} (${submissionNo}) was ` +
            `${isApproved ? 'approved' : 'rejected'} by ${approverName}` +
            `${comment ? `: ${comment}` : ''}`,
        link: `/dashboard/form/submission/${formSubmissionId}`,
        sourceTable: 'form_submission',
        sourceId: formSubmissionId,
        createdBy: approverId,
        uniqueKeyPrefix: `form_submission:${formSubmissionId}:${status}`,
    })

    return [submitterId]
}
