'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    FiDownload,
    FiFile,
    FiPaperclip,
    FiRefreshCw,
    FiTrash2,
    FiUpload,
    FiX,
} from 'react-icons/fi'

async function requestAttachments(taskId, signal) {
    const normalizedTaskId = String(taskId || '').trim()

    if (!/^\d+$/.test(normalizedTaskId)) {
        throw new Error('Task ID ไม่ถูกต้อง')
    }

    const res = await fetch(
        `/api/v1/task/${normalizedTaskId}/attachment`,
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
            'โหลดไฟล์แนบไม่สำเร็จ'
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

function formatFileSize(bytes) {
    const size = Number(bytes || 0)

    if (size < 1024) {
        return `${size} B`
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function getFileTypeLabel(mimeType) {
    if (!mimeType) return 'FILE'

    if (mimeType.startsWith('image/')) {
        return 'IMAGE'
    }

    if (mimeType === 'application/pdf') {
        return 'PDF'
    }

    if (mimeType.includes('wordprocessingml')) {
        return 'DOCX'
    }

    if (mimeType.includes('spreadsheetml')) {
        return 'XLSX'
    }

    if (mimeType.includes('presentationml')) {
        return 'PPTX'
    }

    if (mimeType === 'text/plain') {
        return 'TXT'
    }

    if (mimeType === 'application/zip') {
        return 'ZIP'
    }

    return 'FILE'
}

export default function TaskAttachments({
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

    const fileInputRef = useRef(null)

    const [attachments, setAttachments] = useState([])
    const [currentUserId, setCurrentUserId] = useState('')
    const [currentUserPermissions, setCurrentUserPermissions] = useState([])

    const [selectedFile, setSelectedFile] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isValidTaskId) return

        let ignore = false
        const controller = new AbortController()

        requestAttachments(
            normalizedTaskId,
            controller.signal
        )
            .then((data) => {
                if (ignore) return

                setAttachments(data.attachments || [])
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

    const loadAttachments = async () => {
        if (!isValidTaskId) {
            setError('Task ID ไม่ถูกต้อง')
            return
        }

        try {
            setLoading(true)

            const data =
                await requestAttachments(normalizedTaskId)

            setAttachments(data.attachments || [])
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

    const canDelete = (attachment) => {
        if (!attachment) return false

        if (currentUserPermissions.includes('task.delete')) {
            return true
        }

        return String(attachment.user_id) === String(currentUserId)
    }

    const handleFileChange = (e) => {
        const file = e.target.files?.[0]

        if (!file) return

        setSelectedFile(file)
        setError('')
    }

    const clearSelectedFile = () => {
        setSelectedFile(null)

        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('กรุณาเลือกไฟล์')
            return
        }

        try {
            setUploading(true)

            const formData = new FormData()
            formData.append('file', selectedFile)

            const res = await fetch(
                `/api/v1/task/${normalizedTaskId}/attachment`,
                {
                    method: 'POST',
                    body: formData,
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'แนบไฟล์ไม่สำเร็จ'
                )
            }

            clearSelectedFile()
            setError('')
            await loadAttachments()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setUploading(false)
        }
    }

    const deleteAttachment = async (attachmentId) => {
        try {
            setUploading(true)

            const res = await fetch(
                `/api/v1/task/attachment/${attachmentId}`,
                {
                    method: 'DELETE',
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'ลบไฟล์แนบไม่สำเร็จ'
                )
            }

            setError('')
            setConfirmDelete(null)
            await loadAttachments()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setUploading(false)
        }
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
                    <FiPaperclip className="text-sky-500" />

                    <h2 className="font-semibold text-slate-900 dark:text-white">
                        Attachment
                    </h2>

                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800">
                        {attachments.length}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={loadAttachments}
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

            {confirmDelete && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-medium">
                                ต้องการลบไฟล์แนบนี้ใช่ไหม?
                            </p>
                            <p className="mt-1 text-red-700/80 dark:text-red-200/80">
                                {confirmDelete.original_name}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                disabled={uploading}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <FiX className="h-4 w-4" />
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={() => deleteAttachment(confirmDelete.attachment_id)}
                                disabled={uploading}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-60"
                            >
                                <FiTrash2 className="h-4 w-4" />
                                {uploading ? 'กำลังลบ...' : 'ลบ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-5 rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept="
                        image/jpeg,
                        image/png,
                        image/webp,
                        image/gif,
                        application/pdf,
                        text/plain,
                        application/zip,
                        application/vnd.openxmlformats-officedocument.wordprocessingml.document,
                        application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
                        application/vnd.openxmlformats-officedocument.presentationml.presentation
                    "
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                            อัปโหลดไฟล์แนบ
                        </p>

                        <p className="text-sm text-slate-500">
                            รองรับรูปภาพ, PDF, TXT, ZIP, DOCX, XLSX, PPTX ขนาดไม่เกิน 10MB
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            fileInputRef.current?.click()
                        }
                        className="
                            inline-flex items-center justify-center gap-2
                            rounded-xl border border-slate-300 px-4 py-2 text-sm
                            hover:bg-slate-100
                            dark:border-slate-700 dark:hover:bg-slate-800
                        "
                    >
                        <FiFile />
                        เลือกไฟล์
                    </button>
                </div>

                {selectedFile && (
                    <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900 dark:text-white">
                                {selectedFile.name}
                            </p>

                            <p className="text-sm text-slate-500">
                                {formatFileSize(selectedFile.size)}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={clearSelectedFile}
                                className="
                                    rounded-xl border border-slate-300 p-2
                                    hover:bg-slate-100
                                    dark:border-slate-700 dark:hover:bg-slate-900
                                "
                            >
                                <FiX />
                            </button>

                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading}
                                className="
                                    inline-flex items-center gap-2 rounded-xl
                                    bg-sky-500 px-4 py-2 text-sm font-medium text-white
                                    hover:bg-sky-600 disabled:opacity-50
                                "
                            >
                                <FiUpload />
                                Upload
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="rounded-xl border border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-800">
                    กำลังโหลดไฟล์แนบ...
                </div>
            ) : attachments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
                    ยังไม่มีไฟล์แนบในงานนี้
                </div>
            ) : (
                <div className="space-y-3">
                    {attachments.map((attachment) => (
                        <article
                            key={attachment.attachment_id}
                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-800">
                                    {getFileTypeLabel(attachment.mime_type)}
                                </div>

                                <div className="min-w-0">
                                    <a
                                        href={attachment.file_path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block truncate font-medium text-slate-900 hover:text-sky-500 dark:text-white"
                                    >
                                        {attachment.original_name}
                                    </a>

                                    <p className="text-xs text-slate-500">
                                        {formatFileSize(attachment.file_size)}
                                        {' '}
                                        · อัปโหลดโดย {attachment.uploaded_by_name || '-'}
                                        {' '}
                                        · {formatDateTime(attachment.created_at)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <a
                                    href={attachment.file_path}
                                    download={attachment.original_name}
                                    className="
                                        inline-flex items-center gap-2 rounded-xl
                                        border border-slate-300 px-3 py-2 text-sm
                                        hover:bg-slate-100
                                        dark:border-slate-700 dark:hover:bg-slate-800
                                    "
                                >
                                    <FiDownload />
                                    Download
                                </a>

                                {canDelete(attachment) && (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(attachment)}
                                        disabled={uploading}
                                        className="
                                            rounded-xl p-2 text-slate-400
                                            hover:bg-red-50 hover:text-red-500
                                            disabled:opacity-50
                                            dark:hover:bg-red-950
                                        "
                                    >
                                        <FiTrash2 />
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    )
}
