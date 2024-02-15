const test = require('brittle')
const acl = require('../src/acl')

test('acl', async t => {
  const repoName = 'foo'

  t.test('setACL', async t => {
    const aclObj = acl.setACL(repoName)
    t.is(aclObj.visibility, 'public')
    t.is(aclObj.protectedBranches.length, 2)
    t.ok(aclObj.protectedBranches.includes('master') && aclObj.protectedBranches.includes('main'))
    t.is(Object.keys(aclObj.ACL).length, 0)
  })

  test('getACL', async t => {
    const aclObj = acl.setACL(repoName)
    t.alike(acl.getACL(repoName), aclObj)
  })

  test('makeRepoPublic', async t => {
    acl.makeRepoPublic(repoName)
    t.is(acl.getRepoVisibility(repoName), 'public')
  })

  test('makeRepoPrivate', async t => {
    acl.makeRepoPrivate(repoName)
    t.is(acl.getRepoVisibility(repoName), 'private')
  })

  test('grantAccessToUser', async t => {
    acl.grantAccessToUser(repoName, 'user1', 'admin')
    t.alike(acl.getUserRole(repoName, 'user1'), 'admin')
  })

  test('addProtectedBranch', async t => {
    acl.addProtectedBranch(repoName, 'branch1')
    t.is(acl.getACL(repoName).protectedBranches.length, 3)
  })

  test('removeProtectedBranch', async t => {
    acl.removeProtectedBranch(repoName, 'branch1')
    t.is(acl.getACL(repoName).protectedBranches.length, 2)
  })

  test('getAdmins', async t => {
    acl.grantAccessToUser(repoName, 'user2', 'admin')
    t.alike(acl.getAdmins(repoName), ['user1', 'user2'])
  })

  test('getContributors', async t => {
    acl.grantAccessToUser(repoName, 'user3', 'contributor')
    t.alike(acl.getContributors(repoName), ['user3', 'user1', 'user2'])
  })

  test('getViewers', async t => {
    acl.grantAccessToUser(repoName, 'user4', 'viewer')
    t.alike(acl.getViewers(repoName), ['user4', 'user3', 'user1', 'user2'])
  })
})
