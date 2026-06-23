const pagePermissionRules = [
    {
        pattern: /^\/dashboard\/employee\/new\/?$/,
        permissionKey: 'employee.create',
    },
    {
        pattern: /^\/dashboard\/employee\/[^/]+\/edit\/?$/,
        permissionKey: 'employee.update',
    },
    {
        pattern: /^\/dashboard\/employee(?:\/[^/]+)?\/?$/,
        permissionKey: 'employee.view',
    },
    {
        pattern: /^\/dashboard\/leave\/?$/,
        permissionKey: 'leave.view',
    },
    {
        pattern: /^\/dashboard\/attendance\/?$/,
        permissionKey: 'attendance.view',
    },
    {
        pattern: /^\/dashboard\/project\/new\/?$/,
        permissionKey: 'project.create',
    },
    {
        pattern: /^\/dashboard\/project\/[^/]+\/edit\/?$/,
        permissionKey: 'project.update',
    },
    {
        pattern: /^\/dashboard\/project(?:\/(?:gantt|my-project|[^/]+))?\/?$/,
        permissionKey: 'project.view',
    },
    {
        pattern: /^\/dashboard\/task\/new\/?$/,
        permissionKey: 'task.create',
    },
    {
        pattern: /^\/dashboard\/task\/[^/]+\/edit\/?$/,
        permissionKey: 'task.update',
    },
    {
        pattern: /^\/dashboard\/task(?:\/(?:board|list|my-task|[^/]+))?\/?$/,
        permissionKey: 'task.view',
    },
    {
        pattern: /^\/dashboard\/report\/?$/,
        permissionKey: 'report.view',
    },
    {
        pattern: /^\/dashboard\/activity\/?$/,
        permissionKey: 'activity.view',
    },
    {
        pattern: /^\/dashboard\/audit-log\/?$/,
        permissionKey: 'audit.view',
    },
    {
        pattern: /^\/dashboard\/notification\/?$/,
        permissionKey: 'notification.view',
    },
    {
        pattern: /^\/dashboard\/permission\/?$/,
        permissionKey: 'permission.view',
    },
    {
        pattern: /^\/dashboard\/master-data\/?$/,
        permissionKey: 'master_data.view',
    },
    {
        pattern: /^\/dashboard\/?$/,
        permissionKey: 'dashboard.view',
    },
]

export function getPagePermission(pathname = '') {
    const normalizedPath = String(pathname || '').split('?')[0]

    const rule = pagePermissionRules.find((item) =>
        item.pattern.test(normalizedPath)
    )

    return rule?.permissionKey || null
}

export function canAccessPage(pathname, permissions = []) {
    const permissionKey = getPagePermission(pathname)

    if (!permissionKey) return true

    return Array.isArray(permissions) &&
        permissions.includes(permissionKey)
}

export { pagePermissionRules }
