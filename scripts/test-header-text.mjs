import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(
    new URL('../app/lib/HeaderText.js', import.meta.url),
    'utf8'
)

const headerModule = new vm.SourceTextModule(source, {
    identifier: 'app/lib/HeaderText.js',
})

await headerModule.link(() => {
    throw new Error('HeaderText.js should not import modules')
})
await headerModule.evaluate()

const {
    getHeaderTitle,
    getWelcomeText,
    headerRules,
} = headerModule.namespace

test('getHeaderTitle resolves dashboard and admin routes', () => {
    assert.equal(getHeaderTitle('/dashboard'), 'Dashboard')
    assert.equal(getHeaderTitle('/dashboard/activity'), 'Activity Log')
    assert.equal(getHeaderTitle('/dashboard/audit-log'), 'Audit Log')
    assert.equal(getHeaderTitle('/dashboard/permission'), 'Permission Matrix')
    assert.equal(getHeaderTitle('/dashboard/notification'), 'Notifications')
})

test('getHeaderTitle resolves dynamic resource routes by priority', () => {
    assert.equal(getHeaderTitle('/dashboard/employee/new'), 'Create Employee')
    assert.equal(getHeaderTitle('/dashboard/employee/U001'), 'Employee Detail')
    assert.equal(getHeaderTitle('/dashboard/employee/U001/edit'), 'Edit Employee')
    assert.equal(getHeaderTitle('/dashboard/project/new'), 'Create Project')
    assert.equal(getHeaderTitle('/dashboard/project/gantt'), 'Project Gantt Chart')
    assert.equal(getHeaderTitle('/dashboard/project/my-project'), 'My Projects')
    assert.equal(getHeaderTitle('/dashboard/project/42/edit'), 'Edit Project')
    assert.equal(getHeaderTitle('/dashboard/project/42'), 'Project Detail')
    assert.equal(getHeaderTitle('/dashboard/task/42/edit'), 'Edit Task')
    assert.equal(getHeaderTitle('/dashboard/task/42'), 'Task Detail')
})

test('getWelcomeText returns a route-specific subtitle', () => {
    assert.equal(
        getWelcomeText('/dashboard/leave').includes('คำขอลา'),
        true
    )
    assert.equal(
        getWelcomeText('/dashboard/unknown'),
        'ยินดีต้อนรับกลับ'
    )
})

test('header rule patterns are unique route definitions', () => {
    const rulePatterns = headerRules.map((item) => String(item.pattern))
    const uniquePatterns = new Set(rulePatterns)

    assert.equal(uniquePatterns.size, rulePatterns.length)
})
