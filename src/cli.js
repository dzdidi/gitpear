#!/usr/bin/env node

const { spawn } = require('child_process')

const commander = require('commander')
const program = new commander.Command()

const path = require('path')
const fs = require('fs')

const home = require('./home')
const acl = require('./acl')
const git = require('./git')

const { listRemote, aclRemote } = require('./rpc-requests')

const { printACL, printACLForUser, checkIfGitRepo, logBranches } = require('./utils')

const pkg = require('../package.json')
program
  .name('gitpear')
  .description('CLI to gitpear')
  .version(pkg.version)

program
  .command('init')
  .description('initialize a gitpear repo')
  .option('-p, --path [path]', 'paht to the git repo', '.')
  .option('-s, --share [branch]', 'share the repo as public, default false, default branch is current', '')
  .action(async (options) => {
    const fullPath = path.resolve(options.path)
    checkIfGitRepo(fullPath)

    const name = fullPath.split(path.sep).pop()
    if ((home.isInitialized(name))) {
      console.error(`${name} is already initialized`)
      try {
        await git.addRemote(name)
        console.log(`Added git remote for "${name}" as "pear"`)
      } catch (e) { }
      process.exit(1)
    }

    try {
      home.createAppFolder(name) 
      console.log(`Added project "${name}" to gitpear`)
    } catch (e) { }
    try {
      await git.createBareRepo(name)
      console.log(`Created bare repo for "${name}"`)
    } catch (e) { }
    try {
      await git.addRemote(name)
      console.log(`Added git remote for "${name}" as "pear"`)
    } catch (e) { }

    let branchToShare = await git.getCurrentBranch()
    if (options.share && options.share !== true) {
      branchToShare = options.share
    }

    if (options.share) await share(name, branchToShare)
  })

program
  .command('share')
  .description('share a gitpear repo')
  .option('-b, --branch [b]', 'branch to share, default is current branch', '')
  .option('-v, --visibility [v]', 'visibility of the repo', 'public')
  .option('-p, --path [path]', 'path to the repo', '.')
  .action(async (options) => {
    const fullPath = path.resolve(options.path)
    checkIfGitRepo(fullPath)

    const name = fullPath.split(path.sep).pop()
    if (!home.isInitialized(name)) {
      console.error(`${name} is not initialized`)
      process.exit(1)
    }

    const currentBranch = await git.getCurrentBranch()
    const branchToShare = options.branch || currentBranch
    await share(name, branchToShare, options)
  })

program
  .command('acl')
  .description('manage acl of a gitpear repo')
  .option('-u, --user', 'user to add/remove/list')
  .option('-b, --branch', 'branch to add/remove/list in protected branches')
  .option('-p, --path [path]', 'path to the repo', '.')
  .addArgument(new commander.Argument('[a]', 'actiont to perform').choices(['add', 'remove', 'list']).default('list'))
  .addArgument(new commander.Argument('[n]', 'user or branch to add/remove/list').default(''))
  .action(async (a, n, options) => {
    if (options.user && options.branch) {
      throw new Error('Cannot perform both user and branch action at the same time')
    }

    if (!options.user && !options.branch) {
      throw new Error('Either user or branch option is required')
    }

    if (options.user) {
      if (options.path.startsWith('pear://')) {
        if (n === '.') n = ''
        await remoteACL(a, n, options.path, options)
      } else {
        localACL(a, n, options.path, options)
      }
    } else if (options.branch) {
      if (options.path.startsWith('pear://')) {
        await remoteBranchProtectionRules(a, n, options.path, options)
      } else {
        localBranchProtectionRules(a, n, options.path, options)
      }
    }
  })
  

program
  .command('unshare')
  .description('unshare a gitpear repo')
  .option('-p, --path [path]', 'path to the repo', '.')
  .action((options) => {
    const fullPath = path.resolve(options.path)
    checkIfGitRepo(fullPath)

    const name = fullPath.split(path.sep).pop()
    if ((home.isInitialized(name))) {
      home.unshareAppFolder(name)
      console.log(`Unshared "${name}" project`)

      return
    }

    console.error(`${name} is not initialized`)
    process.exit(1)
  })

program
  .command('list')
  .description('list all gitpear repos')
  .addArgument(new commander.Argument('[u]', 'url to remote pear').default(''))
  .option('-s, --shared', 'list only shared repos')
  .action((u, options) => {
    if (u) return listRemote(u)

    const k = home.readPk()
    const s = options.shared
    home.list(s).forEach(n => console.log(n, ...(s ? ['\t', `pear://${k}/${n}`] : [])))
  })

program
  .command('key')
  .description('get a public key of gitpear')
  .action((p, options) => {
    console.log('Public key:', home.readPk())
  })

program
  .command('daemon')
  .description('start/stop gitpear daemon')
  .option('-s, --start', 'start daemon')
  .option('-k, --stop', 'stop daemon')
  .option('-a, --attach', 'watch daemon logs')
  .action((p, options) => {
    if (options.opts().start && options.opts().stop) {
      console.error('Cannot start and stop daemon at the same time')
      process.exit(1)
    }
    if (!options.opts().start && !options.opts().stop) {
      console.error('Need either start or stop option')
      process.exit(1)
    }

    if (options.opts().start) {
      if (home.getDaemonPid()) {
        console.error('Daemon already running with PID:', home.getDaemonPid())
        process.exit(1)
      }

      const opts = {}
      if (options.opts().attach) {
        opts.stdio = 'inherit'
      } else {
        opts.detached = true
        opts.stdio = [ 'ignore', home.getOutStream(), home.getErrStream() ]
      }

      const daemon = spawn('git-peard', opts)
      console.log('Daemon started. Process ID:', daemon.pid)
      home.storeDaemonPid(daemon.pid)
      // TODO: remove in case of error or exit but allow unref
      // daemon.on('error', home.removeDaemonPid)
      // daemon.on('exit', home.removeDaemonPid)
      daemon.unref()
    } else if (options.opts().stop) {
      if (!home.getDaemonPid()) {
        console.error('Daemon not running')
        process.exit(1)
      }

      const pid = home.getDaemonPid()
      process.kill(pid)

      home.removeDaemonPid()
      console.log('Daemon stopped. Process ID:', pid)
    } else {
      console.error('No option provided')
      process.exit(1)
    }
  })

function localBranchProtectionRules(a, b, p, options) {
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

function localACL(a, u, p, options) {
  console.log('localACL', { a, u, p, options })
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

    const [ userId, role ] = u.split(':')
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
    return
  }
}

async function remoteBranchProtectionRules(a, b, p, options) {
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

async function remoteACL(a, b, p, options) {
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

async function share(name, branchToShare, options) {
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

program.parse()
