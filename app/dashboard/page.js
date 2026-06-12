'use client'

import { useEffect, useState } from 'react'
import { FiPlus } from 'react-icons/fi'

export default function DashboardPage() {
  const [stats, setStats] = useState({ employees: 0, departments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/v1/stats')
        const data = await res.json()

        if (!res.ok) {
          setError(data.message || 'ไม่สามารถโหลดข้อมูลได้')
          return
        }

        setStats({
          employees: data.employees ?? 0,
          departments: data.departments ?? 0,
        })
      } catch (err) {
        console.error('Error loading dashboard stats:', err)
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])


  return (
    <main className="h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 w-full">
      <div className="flex min-h-screen">
        <div className="flex-1 ">
          <section className="py-6">
            {error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-6 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            ) : null}
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
                <p className="text-sm text-slate-500 dark:text-slate-400">พนักงานทั้งหมด</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">
                  {loading ? 'กำลังโหลด...' : stats.employees}
                </p>
              </article>
              <article className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
                <p className="text-sm text-slate-500 dark:text-slate-400">แผนก</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">
                  {loading ? 'กำลังโหลด...' : stats.departments}
                </p>
              </article>
              <article className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
                <p className="text-sm text-slate-500 dark:text-slate-400">งานวันนี้</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">42</p>
              </article>
              <article className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
                <p className="text-sm text-slate-500 dark:text-slate-400">แจ้งเตือน</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">5</p>
              </article>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">กราฟกิจกรรม</p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">สรุปประจำสัปดาห์</h2>
                  </div>
                  <span className="inline-flex rounded-2xl bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-200">+12%</span>
                </div>
                <div className="mt-6 h-40 rounded-3xl bg-slate-100 dark:bg-slate-800"></div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
                  <p className="text-sm text-slate-500 dark:text-slate-400">กิจกรรมล่าสุด</p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                    <li className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-4">ส่งรายงานงวดเช้าเรียบร้อย</li>
                    <li className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-4">อนุมัติคำขอลา 3 รายการ</li>
                    <li className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-4">จองห้องประชุมสำหรับทีม DEV</li>
                  </ul>
                </div>
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
                  <p className="text-sm text-slate-500 dark:text-slate-400">สรุปงานวันนี้</p>
                  <div className="mt-4 grid gap-4 text-sm text-slate-700 dark:text-slate-200">
                    <div className="rounded-3xl bg-slate-50 dark:bg-slate-950 p-4">งานรอดำเนินการ 14 รายการ</div>
                    <div className="rounded-3xl bg-slate-50 dark:bg-slate-950 p-4">งานเสร็จแล้ว 27 รายการ</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
