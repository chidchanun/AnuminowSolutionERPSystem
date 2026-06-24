import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(
    new URL('../app/lib/pagePermissions.js', import.meta.url),
    'utf8'
)

const catalogSource = await readFile(
    new URL('../app/lib/permissionCatalog.js', import.meta.url),
    'utf8'
)

const pagePermissionModule = new vm.SourceTextModule(source, {
    identifier: 'app/lib/pagePermissions.js',
})

await pagePermissionModule.link(() => {
    throw new Error('pagePermissions.js should not import modules')
})
await pagePermissionModule.evaluate()

const catalogModule = new vm.SourceTextModule(catalogSource, {
    identifier: 'app/lib/permissionCatalog.js',
})

await catalogModule.link(() => {
    throw new Error('permissionCatalog.js should not import modules')
})
await catalogModule.evaluate()

const {
    canAccessPage,
    getPagePermission,
    pagePermissionRules,
} = pagePermissionModule.namespace

const {
    getPermissionCatalogKeys,
    permissionCatalog,
} = catalogModule.namespace

test('getPagePermission resolves static dashboard routes', () => {
    assert.equal(getPagePermission('/dashboard'), 'dashboard.view')
    assert.equal(getPagePermission('/dashboard/activity'), 'activity.view')
    assert.equal(getPagePermission('/dashboard/audit-log'), 'audit.view')
    assert.equal(getPagePermission('/dashboard/report'), 'report.view')
    assert.equal(
        getPagePermission('/dashboard/permission'),
        'permission.view'
    )
    assert.equal(
        getPagePermission('/dashboard/master-data'),
        'master_data.view'
    )
    assert.equal(getPagePermission('/dashboard/form'), 'form.view')
    assert.equal(
        getPagePermission('/dashboard/form/submission'),
        'form.view'
    )
})

test('getPagePermission resolves project routes in priority order', () => {
    assert.equal(
        getPagePermission('/dashboard/project/new'),
        'project.create'
    )
    assert.equal(
        getPagePermission('/dashboard/project/42/edit'),
        'project.update'
    )
    assert.equal(
        getPagePermission('/dashboard/project/42'),
        'project.view'
    )
    assert.equal(
        getPagePermission('/dashboard/project/gantt'),
        'project.view'
    )
})

test('getPagePermission resolves task routes in priority order', () => {
    assert.equal(getPagePermission('/dashboard/task/new'), 'task.create')
    assert.equal(
        getPagePermission('/dashboard/task/42/edit'),
        'task.update'
    )
    assert.equal(getPagePermission('/dashboard/task/42'), 'task.view')
    assert.equal(getPagePermission('/dashboard/task/board'), 'task.view')
})

test('getPagePermission resolves employee routes', () => {
    assert.equal(
        getPagePermission('/dashboard/employee/new'),
        'employee.create'
    )
    assert.equal(
        getPagePermission('/dashboard/employee/U001/edit'),
        'employee.update'
    )
    assert.equal(
        getPagePermission('/dashboard/employee/U001'),
        'employee.view'
    )
})

test('getPagePermission resolves form routes in priority order', () => {
    assert.equal(getPagePermission('/dashboard/form/new'), 'form.create')
    assert.equal(
        getPagePermission('/dashboard/form/12/builder'),
        'form.update'
    )
    assert.equal(
        getPagePermission('/dashboard/form/12/fill'),
        'form.fill'
    )
    assert.equal(
        getPagePermission('/dashboard/form/submission/22'),
        'form.view'
    )
})

test('canAccessPage allows pages with matching permission only', () => {
    assert.equal(
        canAccessPage('/dashboard/project/new', ['project.create']),
        true
    )
    assert.equal(
        canAccessPage('/dashboard/project/new', ['project.view']),
        false
    )
    assert.equal(
        canAccessPage('/dashboard/unknown', []),
        true
    )
})

test('permission catalog includes all guarded page permissions', () => {
    const catalogKeys = new Set(getPermissionCatalogKeys())

    for (const rule of pagePermissionRules) {
        assert.equal(
            catalogKeys.has(rule.permissionKey),
            true,
            `${rule.permissionKey} is missing from permissionCatalog`
        )
    }
})

test('permission catalog keys are unique', () => {
    const catalogKeys = getPermissionCatalogKeys()
    const uniqueKeys = new Set(catalogKeys)

    assert.equal(uniqueKeys.size, catalogKeys.length)
    assert.equal(permissionCatalog.length, catalogKeys.length)
})
