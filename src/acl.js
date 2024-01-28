const home = require('./home')
const fs = require('fs')

const ROLES = {
  admin: {
    description: 'Read and write to all branches',
  },
  contributor: {
    description: 'Read and write to all branches except protected ones',
  },
  viewer: {
    description: 'Read all branches',
  },
}
const DEFAULT_ACL = {
  visibility: 'public', // public|private 
  protectedBranches: ['master'],
  ACL: {}
}

function getUserRole (repoName, user) {
  const acl = getACL(repoName)
  return acl.ACL[user]
}

function getAdmins (repoName) {
  const acl = getACL(repoName)
  return Object.keys(acl.ACL).filter(user => acl.ACL[user] === 'admin')
}

function getContributors (repoName) {
  const acl = getACL(repoName)
  const contributors = Object.keys(acl.ACL).filter(user => acl.ACL[user] === 'contributor')
  const admins = getAdmins(repoName)
  return [...contributors, ...admins].filter((user, i, arr) => arr.indexOf(user) === i)
}

function getViewers (repoName) {
  const acl = getACL(repoName)
  const viewers = Object.keys(acl.ACL).filter(user => acl.ACL[user] === 'viewer')
  const contributors = getContributors(repoName)
  const admins = getAdmins(repoName)

  return [...viewers, ...contributors, ...admins].filter((user, i, arr) => arr.indexOf(user) === i)
}

function grantAccessToUser (repoName, user, role) {
  if (!ROLES[role]) throw new Error(`Role ${role} does not exist`)
  if (!Object.keys(ROLES).includes(role)) throw new Error(`Role ${role} is not allowed`)

  const acl = getACL(repoName)
  acl.ACL[user] = role
  setACL(repoName, acl)
}

function addProtectedBranch (repoName, branch) {
  const acl = getACL(repoName)
  acl.protectedBranches.push(branch)
  setACL(repoName, acl)
}

function removeProtectedBranch (repoName, branch) {
  const acl = getACL(repoName)
  acl.protectedBranches = acl.protectedBranches.filter(b => b !== branch)
  setACL(repoName, acl)
}

function makeRepoPublic (repoName) {
  const acl = getACL(repoName)
  acl.visibility = 'public'
  setACL(repoName, acl)
}

function getRepoVisibility (repoName) {
  const acl = getACL(repoName)
  return acl.visibility
}

function makeRepoPrivate (repoName) {
  const acl = getACL(repoName)
  acl.visibility = 'private'
  setACL(repoName, acl)
}

function setACL (repoName, acl = DEFAULT_ACL) {
  acl = { ...DEFAULT_ACL, ...acl }
  if (['public', 'private'].indexOf(acl.visibility) === -1) throw new Error('Visibility must be public or private')

  const content = JSON.stringify(acl, null, 2)
  fs.writeFileSync(home.getACLFilePath(repoName), content)

  return acl
}

function getACL (repoName) {
  return JSON.parse(fs.readFileSync(home.getACLFilePath(repoName), 'utf8') || JSON.stringify(DEFAULT_ACL))
}

module.exports = {
  getUserRole,
  grantAccessToUser,
  makeRepoPublic,
  makeRepoPrivate,
  getRepoVisibility,
  setACL,
  getACL,
  addProtectedBranch,
  removeProtectedBranch,
  getAdmins,
  getContributors,
  getViewers,
}
