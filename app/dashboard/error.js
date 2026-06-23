'use client'

import { useEffect } from 'react'
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'

export default function DashboardError({ error, unstable_retry, reset }) {
    const retry = unstable_retry || reset

    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <main className="min-h-[60vh] bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm dark:border-rose-900 dark:bg-rose-950">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200">
                            <FiAlertTriangle className="h-5 w-5" />
                        </div>

                        <div>
                            <h1 className="text-base font-semibold text-rose-900 dark:text-rose-100">
                                Dashboard เกิดข้อผิดพลาด
                            </h1>

                            <p className="mt-2 max-w-2xl text-sm text-rose-700 dark:text-rose-300">
                                ระบบไม่สามารถแสดงหน้านี้ได้ในตอนนี้ กรุณาลองโหลดใหม่อีกครั้ง
                            </p>

                            {error?.digest && (
                                <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">
                                    Error ID: {error.digest}
                                </p>
                            )}
                        </div>
                    </div>

                    {retry && (
                        <button
                            type="button"
                            onClick={() => retry()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200 dark:hover:bg-rose-900"
                        >
                            <FiRefreshCw className="h-4 w-4" />
                            ลองใหม่
                        </button>
                    )}
                </div>
            </section>
        </main>
    )
}
