'use client'

import { FiPlus } from 'react-icons/fi'

const upcomingTasks = [
    {
        title: 'Login API',
        project: 'HR System',
        due: '1 วัน',
        status: 'In Progress',
    },
    {
        title: 'Employee CRUD',
        project: 'HR System',
        due: '3 วัน',
        status: 'Todo',
    },
]

const recentActivities = [
    'ปิดงาน Login API',
    'สร้าง Employee CRUD',
    'แก้ไข Dashboard UI',
    'เพิ่มระบบ Authentication',
]

const myTasks = [
    {
        title: 'Login API',
        project: 'HR System',
        dueDate: '12 มิ.ย. 2026',
        status: 'In Progress',
    },
    {
        title: 'Employee Form',
        project: 'HR System',
        dueDate: '15 มิ.ย. 2026',
        status: 'Done',
    },
    {
        title: 'Role Management',
        project: 'HR System',
        dueDate: '20 มิ.ย. 2026',
        status: 'Todo',
    },
]

const kanban = {
    todo: [
        'Employee Form',
        'Role CRUD',
        'Department CRUD',
    ],
    progress: [
        'Dashboard UI',
        'Task System',
    ],
    done: [
        'Login Page',
        'JWT Authentication',
    ],
}

export default function TaskPage() {
    return (
        <div className="flex flex-col w-full h-full py-6 gap-6">

            {/* KPI Cards */}
            <div className="grid gap-4 xl:grid-cols-5">
                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        โปรเจกต์ที่รับผิดชอบ
                    </p>
                    <p className="mt-4 text-2xl font-semibold">
                        2
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        งานทั้งหมด
                    </p>
                    <p className="mt-4 text-2xl font-semibold">
                        15
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        งานที่เสร็จแล้ว
                    </p>
                    <p className="mt-4 text-2xl font-semibold">
                        8
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        กำลังดำเนินการ
                    </p>
                    <p className="mt-4 text-2xl font-semibold">
                        5
                    </p>
                </article>

                <article className="rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <p className="text-sm text-red-500">
                        งานเกินกำหนด
                    </p>
                    <p className="mt-4 text-2xl font-semibold text-red-500">
                        2
                    </p>
                </article>
            </div>

            {/* Upcoming + Activity */}
            <div className="grid gap-6 lg:grid-cols-2">

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">
                        งานใกล้ถึงกำหนด
                    </h2>

                    <div className="mt-4 space-y-3">
                        {upcomingTasks.map((task) => (
                            <div
                                key={task.title}
                                className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800 p-4"
                            >
                                <div>
                                    <p className="font-medium">
                                        {task.title}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {task.project}
                                    </p>
                                </div>

                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                                    เหลือ {task.due}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">
                        กิจกรรมล่าสุด
                    </h2>

                    <div className="mt-4 space-y-4">
                        {recentActivities.map((activity, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3"
                            >
                                <div className="h-2 w-2 rounded-full bg-sky-500" />
                                <span>{activity}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* My Tasks */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-500">
                            งานที่ได้รับมอบหมาย
                        </p>

                        <h2 className="mt-2 text-xl font-semibold">
                            งานของฉัน
                        </h2>
                    </div>

                    <button className="inline-flex items-center rounded-2xl bg-sky-500 px-4 py-2 text-white hover:bg-sky-600">
                        <FiPlus className="mr-2" />
                        เพิ่มงาน
                    </button>
                </div>

                <div className="mt-6 overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                                <th className="py-3 text-left">
                                    งาน
                                </th>
                                <th className="py-3 text-left">
                                    โปรเจกต์
                                </th>
                                <th className="py-3 text-left">
                                    กำหนดส่ง
                                </th>
                                <th className="py-3 text-left">
                                    สถานะ
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {myTasks.map((task) => (
                                <tr
                                    key={task.title}
                                    className="border-b border-slate-100 dark:border-slate-800"
                                >
                                    <td className="py-4">
                                        {task.title}
                                    </td>

                                    <td>
                                        {task.project}
                                    </td>

                                    <td>
                                        {task.dueDate}
                                    </td>

                                    <td>
                                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                                            {task.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>

            {/* Kanban */}
            <div className="grid gap-6 lg:grid-cols-3">

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                    <h3 className="font-semibold mb-4">
                        TODO
                    </h3>

                    <div className="space-y-3">
                        {kanban.todo.map((item) => (
                            <div
                                key={item}
                                className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                    <h3 className="font-semibold mb-4">
                        IN PROGRESS
                    </h3>

                    <div className="space-y-3">
                        {kanban.progress.map((item) => (
                            <div
                                key={item}
                                className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                    <h3 className="font-semibold mb-4">
                        DONE
                    </h3>

                    <div className="space-y-3">
                        {kanban.done.map((item) => (
                            <div
                                key={item}
                                className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

            </div>

        </div>
    )
}