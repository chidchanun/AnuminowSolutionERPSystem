'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
    FiArrowLeft,
    FiFileText,
    FiRefreshCw,
    FiSend,
} from 'react-icons/fi'
import FormDocumentRenderer from '@/app/components/FormDocumentRenderer'

function safeLayout(layout) {
    return {
        title: layout?.title || '',
        fields: Array.isArray(layout?.fields) ? layout.fields : [],
    }
}

async function requestTemplate(templateId, signal) {
    const res = await fetch(`/api/v1/form-template/${templateId}`, {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลดแบบฟอร์มไม่สำเร็จ')
    }

    return data.template
}

export default function FillFormPage() {
    const params = useParams()
    const router = useRouter()

    const templateId = params.id

    const [template, setTemplate] = useState(null)
    const [formData, setFormData] = useState({})

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const layout = useMemo(
        () => safeLayout(template?.layout_json),
        [template]
    )

    useEffect(() => {
        const controller = new AbortController()
        let ignore = false

        requestTemplate(templateId, controller.signal)
            .then((data) => {
                if (ignore) return
                setTemplate(data)
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return
                setError(err.message || 'โหลดแบบฟอร์มไม่สำเร็จ')
            })
            .finally(() => {
                if (ignore) return
                setLoading(false)
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [templateId])

    const updateFieldValue = (fieldId, value) => {
        setFormData((prev) => ({
            ...prev,
            [fieldId]: value,
        }))
    }

    const submitForm = async () => {
        setSubmitting(true)
        setError('')
        setSuccess('')

        try {
            const res = await fetch(`/api/v1/form-template/${templateId}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data_json: formData,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || 'ส่งแบบฟอร์มไม่สำเร็จ')
            }

            setSuccess('ส่งแบบฟอร์มสำเร็จ')

            router.push(`/dashboard/form/submission/${data.form_submission_id}`)
        } catch (err) {
            setError(err.message || 'ส่งแบบฟอร์มไม่สำเร็จ')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
                <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    กำลังโหลดแบบฟอร์ม...
                </div>
            </main>
        )
    }

    if (!template) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
                <div className="mx-auto max-w-7xl rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
                    {error || 'ไม่พบแบบฟอร์ม'}
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <section className="no-print flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                            <FiFileText className="text-xl" />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            กรอกแบบฟอร์ม
                        </h1>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {template.form_name} / {template.form_code}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/dashboard/form"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                            <FiArrowLeft />
                            กลับ
                        </Link>

                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                            <FiRefreshCw />
                            รีเฟรช
                        </button>

                        <button
                            type="button"
                            onClick={submitForm}
                            disabled={submitting || template.status !== 'active'}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-2 text-sm text-white hover:bg-sky-600 disabled:opacity-60"
                        >
                            <FiSend />
                            {submitting ? 'กำลังส่ง...' : 'ส่งแบบฟอร์ม'}
                        </button>
                    </div>
                </section>

                {template.status !== 'active' && (
                    <div className="no-print rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                        แบบฟอร์มนี้ยังไม่เปิดใช้งาน จึงไม่สามารถส่งข้อมูลได้
                    </div>
                )}

                {error && (
                    <div className="no-print rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="no-print rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                        {success}
                    </div>
                )}

                <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-200/60 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <FormDocumentRenderer
                        title={template.form_name}
                        description={template.description}
                        fields={layout.fields}
                        data={formData}
                        editable
                        onChange={updateFieldValue}
                        documentConfig={template.layout_json?.document}
                    />
                </section>
            </div>
        </main>
    )
}