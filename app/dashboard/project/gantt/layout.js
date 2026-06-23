export const metadata = {
    title: 'Project Gantt Chart | Anuminow Solution ERP',
    description: 'ดูแผนงาน ระยะเวลา และความคืบหน้าของโครงการ',
    robots: 'index, follow',
}

export default function GanttChartProjectLayout({ children }) {
    return (
        <main className="min-w-0 flex-1 overflow-x-hidden">
            {children}
        </main>
    )
}
