const headerRules = [
    {
        pattern: /^\/dashboard\/?$/,
        title: 'Dashboard',
        welcome: 'ภาพรวมระบบ ERP',
    },
    {
        pattern: /^\/dashboard\/notification\/?$/,
        title: 'Notifications',
        welcome: 'ติดตามการแจ้งเตือนและรายการที่ต้องรับทราบ',
    },
    {
        pattern: /^\/dashboard\/employee\/new\/?$/,
        title: 'Create Employee',
        welcome: 'เพิ่มข้อมูลพนักงานใหม่เข้าสู่ระบบ',
    },
    {
        pattern: /^\/dashboard\/employee\/[^/]+\/edit\/?$/,
        title: 'Edit Employee',
        welcome: 'แก้ไขข้อมูลพนักงานและสิทธิ์ที่เกี่ยวข้อง',
    },
    {
        pattern: /^\/dashboard\/employee\/[^/]+\/?$/,
        title: 'Employee Detail',
        welcome: 'ตรวจสอบข้อมูลพนักงาน โครงการ และกิจกรรมล่าสุด',
    },
    {
        pattern: /^\/dashboard\/employee\/?$/,
        title: 'Employees',
        welcome: 'จัดการข้อมูลพนักงาน แผนก ตำแหน่ง และสถานะการทำงาน',
    },
    {
        pattern: /^\/dashboard\/leave\/?$/,
        title: 'Leave Requests',
        welcome: 'ส่งคำขอลา ตรวจสอบสถานะ และอนุมัติรายการตามสิทธิ์',
    },
    {
        pattern: /^\/dashboard\/attendance\/?$/,
        title: 'Attendance',
        welcome: 'ตรวจสอบและบันทึกข้อมูลการเข้างานของพนักงาน',
    },
    {
        pattern: /^\/dashboard\/project\/gantt\/?$/,
        title: 'Project Gantt Chart',
        welcome: 'ดูแผนงาน ระยะเวลา และความคืบหน้าของโครงการ',
    },
    {
        pattern: /^\/dashboard\/project\/my-project\/?$/,
        title: 'My Projects',
        welcome: 'โครงการที่คุณเกี่ยวข้องและงานที่ต้องติดตาม',
    },
    {
        pattern: /^\/dashboard\/project\/new\/?$/,
        title: 'Create Project',
        welcome: 'สร้างโครงการใหม่ กำหนดรายละเอียด และเพิ่มสมาชิก',
    },
    {
        pattern: /^\/dashboard\/project\/[^/]+\/edit\/?$/,
        title: 'Edit Project',
        welcome: 'แก้ไขรายละเอียดโครงการและสมาชิกที่เกี่ยวข้อง',
    },
    {
        pattern: /^\/dashboard\/project\/[^/]+\/?$/,
        title: 'Project Detail',
        welcome: 'รายละเอียดโครงการ งาน สมาชิก และความคืบหน้า',
    },
    {
        pattern: /^\/dashboard\/project\/?$/,
        title: 'Projects',
        welcome: 'จัดการโครงการ สถานะ และทีมที่รับผิดชอบ',
    },
    {
        pattern: /^\/dashboard\/task\/board\/?$/,
        title: 'Kanban Board',
        welcome: 'ติดตามงานตามสถานะบนบอร์ด',
    },
    {
        pattern: /^\/dashboard\/task\/list\/?$/,
        title: 'All Tasks',
        welcome: 'รายการงานทั้งหมดตามสิทธิ์การเข้าถึง',
    },
    {
        pattern: /^\/dashboard\/task\/my-task\/?$/,
        title: 'My Tasks',
        welcome: 'งานที่คุณได้รับมอบหมายและต้องติดตาม',
    },
    {
        pattern: /^\/dashboard\/task\/new\/?$/,
        title: 'Create Task',
        welcome: 'สร้างงานใหม่ กำหนดผู้รับผิดชอบ และวันครบกำหนด',
    },
    {
        pattern: /^\/dashboard\/task\/[^/]+\/edit\/?$/,
        title: 'Edit Task',
        welcome: 'แก้ไขรายละเอียดงาน ผู้รับผิดชอบ และสถานะงาน',
    },
    {
        pattern: /^\/dashboard\/task\/[^/]+\/?$/,
        title: 'Task Detail',
        welcome: 'รายละเอียดงาน ความคืบหน้า ความคิดเห็น และไฟล์แนบ',
    },
    {
        pattern: /^\/dashboard\/task\/?$/,
        title: 'Task Dashboard',
        welcome: 'ภาพรวมงาน ลำดับความสำคัญ และรายการที่ต้องดำเนินการ',
    },
    {
        pattern: /^\/dashboard\/report\/?$/,
        title: 'Reports',
        welcome: 'สรุปข้อมูลโครงการ งาน และประสิทธิภาพการทำงาน',
    },
    {
        pattern: /^\/dashboard\/activity\/?$/,
        title: 'Activity Log',
        welcome: 'ตรวจสอบประวัติการเปลี่ยนแปลงและกิจกรรมของงาน',
    },
    {
        pattern: /^\/dashboard\/audit-log\/?$/,
        title: 'Audit Log',
        welcome: 'ตรวจสอบประวัติการเปลี่ยนแปลงข้อมูลและสิทธิ์ในระบบ',
    },
    {
        pattern: /^\/dashboard\/permission\/?$/,
        title: 'Permission Matrix',
        welcome: 'จัดการสิทธิ์การเข้าถึงของแต่ละ permission role',
    },
    {
        pattern: /^\/dashboard\/master-data\/?$/,
        title: 'Master Data',
        welcome: 'จัดการข้อมูลแผนกและตำแหน่งที่ใช้ร่วมกันในระบบ',
    },
]

function normalizePathname(pathname) {
    return String(pathname || '')
        .split('?')[0]
        .toLowerCase()
}

function getHeaderRule(pathname) {
    const normalized = normalizePathname(pathname)

    return headerRules.find((item) =>
        item.pattern.test(normalized)
    )
}

export const getHeaderTitle = (pathname) => {
    return getHeaderRule(pathname)?.title || 'Dashboard'
}

export const getWelcomeText = (pathname) => {
    return getHeaderRule(pathname)?.welcome || 'ยินดีต้อนรับกลับ'
}

export { headerRules }
