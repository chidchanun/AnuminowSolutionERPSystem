'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
    FiEdit2,
    FiMessageSquare,
    FiRefreshCw,
    FiSend,
    FiTrash2,
    FiX,
} from 'react-icons/fi'

async function requestComments(taskId, signal) {
    const normalizedTaskId = String(taskId || '').trim()

    if (!/^\d+$/.test(normalizedTaskId)) {
        throw new Error('Task ID ไม่ถูกต้อง')
    }

    const res = await fetch(
        `/api/v1/task/${normalizedTaskId}/comment`,
        {
            cache: 'no-store',
            signal,
        }
    )

    const data = await res.json()

    if (!res.ok) {
        throw new Error(
            data.error_detail ||
            data.message ||
            'โหลด comment ไม่สำเร็จ'
        )
    }

    return data
}

function formatDateTime(value) {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return '-'
    }

    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function getInitials(name) {
    if (!name) return '?'

    return name
        .trim()
        .split(' ')
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
}

function isRootComment(comment) {
    return (
        comment.parent_comment_id === null ||
        comment.parent_comment_id === undefined ||
        comment.parent_comment_id === '' ||
        String(comment.parent_comment_id) === '0'
    )
}

export default function TaskComments({
    taskId,
}) {
    const normalizedTaskId = useMemo(() => {
        if (Array.isArray(taskId)) {
            return String(taskId[0] || '').trim()
        }

        return String(taskId || '').trim()
    }, [taskId])

    const isValidTaskId =
        /^\d+$/.test(normalizedTaskId)

    const [comments, setComments] = useState([])
    const [currentUserId, setCurrentUserId] = useState('')
    const [currentUserPermissions, setCurrentUserPermissions] = useState([])

    const [commentText, setCommentText] = useState('')
    const [replyingId, setReplyingId] = useState(null)
    const [replyText, setReplyText] = useState('')

    const [editingId, setEditingId] = useState(null)
    const [editingText, setEditingText] = useState('')

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const rootComments = useMemo(() => {
        return comments.filter(isRootComment)
    }, [comments])

    const getReplies = (commentId) => {
        return comments.filter(
            (comment) =>
                String(comment.parent_comment_id) ===
                String(commentId)
        )
    }

    useEffect(() => {
        if (!isValidTaskId) return

        let ignore = false
        const controller = new AbortController()

        requestComments(
            normalizedTaskId,
            controller.signal
        )
            .then((data) => {
                if (ignore) return

                setComments(data.comments || [])
                setCurrentUserId(data.current_user_id || '')
                setCurrentUserPermissions(data.current_user_permissions || [])
                setError('')
            })
            .catch((error) => {
                if (
                    ignore ||
                    error.name === 'AbortError'
                ) {
                    return
                }

                console.error(error)
                setError(error.message)
            })
            .finally(() => {
                if (!ignore) {
                    setLoading(false)
                }
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [
        normalizedTaskId,
        isValidTaskId,
    ])

    const loadComments = async () => {
        if (!isValidTaskId) {
            setError('Task ID ไม่ถูกต้อง')
            return
        }

        try {
            setLoading(true)

            const data =
                await requestComments(normalizedTaskId)

            setComments(data.comments || [])
            setCurrentUserId(data.current_user_id || '')
            setCurrentUserPermissions(data.current_user_permissions || [])
            setError('')
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    const canModify = (comment) => {
        if (!comment) return false

        if (
            currentUserPermissions.includes('task.update') ||
            currentUserPermissions.includes('task.delete')
        ) {
            return true
        }

        return String(comment.user_id) === String(currentUserId)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        const text = commentText.trim()

        if (!text) {
            setError('กรุณากรอก comment')
            return
        }

        try {
            setSubmitting(true)

            const res = await fetch(
                `/api/v1/task/${normalizedTaskId}/comment`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        comment: text,
                    }),
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'เพิ่ม comment ไม่สำเร็จ'
                )
            }

            setCommentText('')
            setError('')
            await loadComments()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const submitReply = async (parentCommentId) => {
        const text = replyText.trim()

        if (!text) {
            setError('กรุณากรอก reply')
            return
        }

        try {
            setSubmitting(true)

            const res = await fetch(
                `/api/v1/task/${normalizedTaskId}/comment`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        comment: text,
                        parent_comment_id: parentCommentId,
                    }),
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'เพิ่ม reply ไม่สำเร็จ'
                )
            }

            setReplyingId(null)
            setReplyText('')
            setError('')
            await loadComments()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const startEdit = (comment) => {
        setEditingId(comment.comment_id)
        setEditingText(comment.comment || '')
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditingText('')
    }

    const saveEdit = async (commentId) => {
        const text = editingText.trim()

        if (!text) {
            setError('กรุณากรอก comment')
            return
        }

        try {
            setSubmitting(true)

            const res = await fetch(
                `/api/v1/task/comment/${commentId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        comment: text,
                    }),
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'แก้ไข comment ไม่สำเร็จ'
                )
            }

            cancelEdit()
            setError('')
            await loadComments()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const deleteComment = async (commentId) => {
        const confirmed =
            window.confirm('ต้องการลบ comment นี้หรือไม่?')

        if (!confirmed) return

        try {
            setSubmitting(true)

            const res = await fetch(
                `/api/v1/task/comment/${commentId}`,
                {
                    method: 'DELETE',
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'ลบ comment ไม่สำเร็จ'
                )
            }

            setError('')
            await loadComments()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const renderAvatar = (comment, size = 40) => {
        const sizeClass =
            size === 32
                ? 'h-8 w-8 text-xs'
                : 'h-10 w-10 text-sm'

        return (
            <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${sizeClass}`}>
                {comment.picture_path ? (
                    <Image
                        src={comment.picture_path}
                        alt={comment.user_full_name || 'User'}
                        width={size}
                        height={size}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    getInitials(comment.user_full_name)
                )}
            </div>
        )
    }

    const renderCommentBody = (comment) => {
        if (editingId === comment.comment_id) {
            return (
                <div className="mt-3">
                    <textarea
                        value={editingText}
                        onChange={(e) =>
                            setEditingText(e.target.value)
                        }
                        rows={3}
                        className="
                            w-full resize-none rounded-xl
                            border border-slate-300 bg-white p-3
                            text-sm outline-none focus:border-sky-500
                            dark:border-slate-700 dark:bg-slate-950
                        "
                    />

                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={cancelEdit}
                            className="
                                inline-flex items-center gap-2
                                rounded-xl border border-slate-300
                                px-3 py-2 text-sm
                                hover:bg-slate-100
                                dark:border-slate-700 dark:hover:bg-slate-800
                            "
                        >
                            <FiX />
                            ยกเลิก
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                saveEdit(comment.comment_id)
                            }
                            disabled={submitting}
                            className="
                                rounded-xl bg-sky-500 px-4 py-2
                                text-sm font-medium text-white
                                hover:bg-sky-600 disabled:opacity-50
                            "
                        >
                            บันทึก
                        </button>
                    </div>
                </div>
            )
        }

        return (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
                {comment.comment}
            </p>
        )
    }

    if (!isValidTaskId) {
        return (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950">
                Task ID ไม่ถูกต้อง
            </section>
        )
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <FiMessageSquare className="text-sky-500" />

                    <h2 className="font-semibold text-slate-900 dark:text-white">
                        Comment
                    </h2>

                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800">
                        {comments.length}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={loadComments}
                    disabled={loading}
                    className="
                        inline-flex items-center gap-2 rounded-xl
                        border border-slate-300 px-3 py-2 text-sm
                        hover:bg-slate-100 disabled:opacity-50
                        dark:border-slate-700 dark:hover:bg-slate-800
                    "
                >
                    <FiRefreshCw
                        className={loading ? 'animate-spin' : ''}
                    />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="mb-5"
            >
                <textarea
                    value={commentText}
                    onChange={(e) =>
                        setCommentText(e.target.value)
                    }
                    rows={3}
                    placeholder="เขียน comment..."
                    className="
                        w-full resize-none rounded-xl border border-slate-300
                        bg-white p-3 text-sm outline-none
                        focus:border-sky-500
                        dark:border-slate-700 dark:bg-slate-950
                    "
                />

                <div className="mt-3 flex justify-end">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="
                            inline-flex items-center gap-2 rounded-xl
                            bg-sky-500 px-4 py-2 text-sm font-medium text-white
                            hover:bg-sky-600 disabled:opacity-50
                        "
                    >
                        <FiSend />
                        ส่ง Comment
                    </button>
                </div>
            </form>

            {loading ? (
                <div className="rounded-xl border border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-800">
                    กำลังโหลด comment...
                </div>
            ) : comments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
                    ยังไม่มี comment ในงานนี้
                </div>
            ) : rootComments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
                    ไม่พบ comment หลัก
                </div>
            ) : (
                <div className="space-y-4">
                    {rootComments.map((comment) => {
                        const replies =
                            getReplies(comment.comment_id)

                        return (
                            <article
                                key={comment.comment_id}
                                className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                            >
                                <div className="flex items-start gap-3">
                                    {renderAvatar(comment, 40)}

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {comment.user_full_name}
                                                </p>

                                                <p className="text-xs text-slate-500">
                                                    {formatDateTime(comment.created_at)}
                                                    {comment.updated_at && (
                                                        <span>
                                                            {' '}
                                                            · แก้ไขแล้ว
                                                        </span>
                                                    )}
                                                </p>
                                            </div>

                                            {canModify(comment) && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            startEdit(comment)
                                                        }
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-800"
                                                    >
                                                        <FiEdit2 />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            deleteComment(
                                                                comment.comment_id
                                                            )
                                                        }
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {renderCommentBody(comment)}

                                        <div className="mt-3 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReplyingId(comment.comment_id)
                                                    setReplyText('')
                                                }}
                                                className="text-sm font-medium text-sky-500 hover:text-sky-400"
                                            >
                                                Reply
                                            </button>
                                        </div>

                                        {replyingId === comment.comment_id && (
                                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                                                <textarea
                                                    value={replyText}
                                                    onChange={(e) =>
                                                        setReplyText(e.target.value)
                                                    }
                                                    rows={2}
                                                    placeholder="เขียน reply..."
                                                    className="
                                                        w-full resize-none rounded-xl border border-slate-300
                                                        bg-white p-3 text-sm outline-none
                                                        focus:border-sky-500
                                                        dark:border-slate-700 dark:bg-slate-900
                                                    "
                                                />

                                                <div className="mt-3 flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setReplyingId(null)
                                                            setReplyText('')
                                                        }}
                                                        className="
                                                            rounded-xl border border-slate-300 px-3 py-2
                                                            text-sm hover:bg-slate-100
                                                            dark:border-slate-700 dark:hover:bg-slate-800
                                                        "
                                                    >
                                                        ยกเลิก
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            submitReply(comment.comment_id)
                                                        }
                                                        disabled={submitting}
                                                        className="
                                                            rounded-xl bg-sky-500 px-4 py-2
                                                            text-sm font-medium text-white
                                                            hover:bg-sky-600 disabled:opacity-50
                                                        "
                                                    >
                                                        ส่ง Reply
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {replies.length > 0 && (
                                            <div className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4 dark:border-slate-800">
                                                {replies.map((reply) => (
                                                    <article
                                                        key={reply.comment_id}
                                                        className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            {renderAvatar(reply, 32)}

                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div>
                                                                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                                            {reply.user_full_name}
                                                                        </p>

                                                                        <p className="text-xs text-slate-500">
                                                                            {formatDateTime(reply.created_at)}
                                                                            {reply.updated_at && (
                                                                                <span>
                                                                                    {' '}
                                                                                    · แก้ไขแล้ว
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                    </div>

                                                                    {canModify(reply) && (
                                                                        <div className="flex items-center gap-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    startEdit(reply)
                                                                                }
                                                                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-800"
                                                                            >
                                                                                <FiEdit2 />
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    deleteComment(
                                                                                        reply.comment_id
                                                                                    )
                                                                                }
                                                                                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                                                                            >
                                                                                <FiTrash2 />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {renderCommentBody(reply)}
                                                            </div>
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
