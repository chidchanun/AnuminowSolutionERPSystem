export const metadata = {
    title: "Gantt Chart Project | Anuminow ERP System",
    descripton: "ระบบแสดง Gantt Chart Project สำหรับพนักงาน",
    robots: "index, following"
}

export default function GanttChartProjectLayout({ children }) {
    return (
        <main className="min-w-0 flex-1 overflow-x-hidden">
            {children}
        </main>
    )
}