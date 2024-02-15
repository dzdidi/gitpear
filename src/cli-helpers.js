const path = require('path')

const home = require('./home')
const acl = require('./acl')
const git = require('./git')

const { aclRemote } = require('./rpc-requests')
const { printACL, printACLForUser, checkIfGitRepo, logBranches } = require('./utils')

async function remoteACL (a, b, p, options) {
  if (a === 'list') {
    await aclRemote.list(p, b)
  } else if (a === 'add') {
    if (!b) {
      console.error('User not provided')
      process.exit(1)
    }
    if (b.split(':').length !== 2) {
      console.error('Invalid role')
      process.exit(1)
    }
    await aclRemote.add(p, b)
  } else if (a === 'remove') {
    if (!b) {
      console.error('User not provided')
      process.exit(1)
    }
    await aclRemote.remove(p, b)
  } else {
    throw new Error('Invalid action')
  }
}

async function share (name, branchToShare, options) {
  let aclOptions
  let message = `Shared "${name}" project, ${branchToShare} branch`
  if (options?.visibility) {
    aclOptions = { visibility: options.visibility }
    message = `${message}, as ${options.visibility} repo`
  }

  try { home.shareAppFolder(name) } catch (e) { }
  try { acl.setACL(name, aclOptions) } catch (e) { }
  try { await git.push(branchToShare) } catch (e) { }
  console.log(message)
}

async function remoteBranchProtectionRules (a, b, p, options) {
  if (a === 'list') {
    await aclRemote.list(p, b, { branch: true })
  } else if (a === 'add') {
    await aclRemote.add(p, b, { branch: true })
    if (!b) {
      console.error('branch is not provided')
      process.exit(1)
    }
  } else if (a === 'remove') {
    if (!b) {
      console.error('branch is not provided')
      process.exit(1)
    }
    await aclRemote.remove(p, b, { branch: true })
  } else {
    throw new Error('Invalid action')
  }
}

function localACL (a, u, p, options) {
  const fullPath = path.resolve(p)
  checkIfGitRepo(fullPath)

  const name = fullPath.split(path.sep).pop()
  if (!home.isInitialized(name)) {
    console.error(`${name} is not initialized`)
    process.exit(1)
  }
  const repoACL = acl.getACL(name)

  if (a === 'list' && !u) {
    printACL(repoACL)
    return
  }

  if (a === 'list') {
    printACLForUser(repoACL, u)
    return
  }

  if (a === 'add') {
    if (!u) {
      console.error('User not provided')
      process.exit(1)
    }

    const [userId, role] = u.split(':')
    if (repoACL.ACL[userId]) {
      console.error(`${userId} already has access to ${name} as ${repoACL.ACL[userId]}`)
      process.exit(1)
    }

    acl.grantAccessToUser(name, userId, role)
    console.log(`Added ${userId} to ${name} as ${role}`)
    return
  }

  if (a === 'remove') {
    if (!u) {
      console.error('User not provided')
      process.exit(1)
    }

    if (!repoACL.ACL[u]) {
      console.error(`${u} does not have access to ${name}`)
      process.exit(1)
    }

    acl.revokeAccessFromUser(name, u)
    console.log(`Removed ${u} from ${name}`)
  }
}

function localBranchProtectionRules (a, b, p, options) {
  const fullPath = path.resolve(p)
  checkIfGitRepo(fullPath)

  const name = fullPath.split(path.sep).pop()
  if (!home.isInitialized(name)) {
    console.error(`${name} is not initialized`)
    process.exit(1)
  }

  if (a === 'list' && !b) {
    const repoACL = acl.getACL(name)
    logBranches(repoACL)
  }

  if (a === 'add') {
    acl.addProtectedBranch(name, b)
    const repoACL = acl.getACL(name)
    logBranches(repoACL)
  }
  if (a === 'remove') {
    acl.removeProtectedBranch(name, b)
    const repoACL = acl.getACL(name)
    logBranches(repoACL)
  }
}

module.exports = {
  remoteACL,
  share,
  remoteBranchProtectionRules,
  localACL,
  localBranchProtectionRules

}
