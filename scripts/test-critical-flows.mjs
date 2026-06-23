import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const leaveDetailRouteSource = await readFile(
    new URL('../app/api/v1/leave/[id]/route.js', import.meta.url),
    'utf8'
)
const taskCommentRouteSource = await readFile(
    new URL('../app/api/v1/task/comment/[commentId]/route.js', import.meta.url),
    'utf8'
)
const taskAttachmentRouteSource = await readFile(
    new URL('../app/api/v1/task/attachment/[attachmentId]/route.js', import.meta.url),
    'utf8'
)

test('leave approval blocks approving or rejecting the requester own leave', () => {
    assert.match(
        leaveDetailRouteSource,
        /String\(leave\.user_id\)\s*===\s*String\(user\.id\)/
    )
    assert.match(
        leaveDetailRouteSource,
        /ไม่สามารถอนุมัติหรือปฏิเสธคำขอลาของตัวเองได้/
    )
})

test('task comment modification uses permission keys instead of role names', () => {
    assert.match(taskCommentRouteSource, /hasPermissionKey\(user,\s*'task\.update'\)/)
    assert.match(taskCommentRouteSource, /hasPermissionKey\(user,\s*'task\.delete'\)/)
    assert.doesNotMatch(taskCommentRouteSource, /Admin|Manager|current_user_role/)
})

test('task attachment deletion uses task.delete permission key', () => {
    assert.match(taskAttachmentRouteSource, /hasPermissionKey\(user,\s*'task\.delete'\)/)
    assert.doesNotMatch(taskAttachmentRouteSource, /Admin|Manager|current_user_role/)
})
