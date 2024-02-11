#!/usr/bin/env node

const { spawn } = require('child_process')

const commander = require('commander')
const program = new commander.Command()

const path = require('path')
const fs = require('fs')

const home = require('./home')
const acl = require('./acl')
const git = require('./git')

const { listRemote } = require('./rpc-requests')

const pkg = require('../package.json')
program
  .name('gitpear')
  .description('CLI to gitpear')
  .version(pkg.version)

program
  .command('init')
  .description('initialize a gitpear repo')
  .addArgument(new commander.Argument('[p]', 'path to the repo').default('.'))
  .option('-s, --share [branch]', 'share the repo as public, default false, default branch is current', '')
  .action(async (p, options) => {
    const fullPath = path.resolve(p)
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
  .option('-p, --path [p]', 'path to the repo', '.')
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
  .command('branch')
  .description('branch protection rules')
  .addArgument(new commander.Argument('[a]', 'actiont to perform').choices(['add', 'remove', 'list']).default('list'))
  .addArgument(new commander.Argument('[b]', 'branch name').default(''))
  .addArgument(new commander.Argument('[p]', 'path to the repo').default('.'))
  .action(async (a, b, p, options) => {
    if (p.startsWith('pear://')) {
      await remoteBranchProtectionRules(a, b, p, options)
    } else {
      localBranchProtectionRules(a, b, p, options)
    }
  })


program
  .command('acl')
  .description('set acl of a gitpear repo')
  .addArgument(new commander.Argument('[a]', 'actiont to perform').choices(['add', 'remove', 'list']).default('list'))
  .addArgument(new commander.Argument('[u]', 'user to add/remove/list').default(''))
  .addArgument(new commander.Argument('[p]', 'path to the repo').default('.'))
  .action(async (a, u, p, options) => {

    if (p.startsWith('pear://')) {
      await remoteACL(a, u, p, options)
    } else {
      localACL(a, u, p, options)
    }
  })
  

program
  .command('unshare')
  .description('unshare a gitpear repo')
  .addArgument(new commander.Argument('[p]', 'path to the repo').default('.'))
  .action((p, options) => {
    const fullPath = path.resolve(p)
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

  if (a === 'list' && !b) { logBranches(name) }
  if (a === 'add') {
    acl.addProtectedBranch(name, b)
    logBranches(name)
  }
  if (a === 'remove') {
    acl.removeProtectedBranch(name, b)
    logBranches(name)
  }
}

function localACL(a, u, p, options) {
  const fullPath = path.resolve(p)
  checkIfGitRepo(fullPath)

  const name = fullPath.split(path.sep).pop()
  if (!home.isInitialized(name)) {
    console.error(`${name} is not initialized`)
    process.exit(1)
  }
  const repoACL = acl.getACL(name)

  if (a === 'list' && !u) {
    console.log('Repo Visibility:', '\t', repoACL.visibility)
    console.log('User:', '\t', 'Role:')
    for (const user in repoACL.ACL) {
      console.log(user, '\t', repoACL.ACL[user])
    }
    return
  }

  if (a === 'list') {
    console.log('Repo Visibility:', '\t', repoACL.visibility)
    console.log('User:', u, '\t', repoACL.ACL[u])
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
}

async function remoteACL(a, b, p, options) {
}

function checkIfGitRepo(p) {
  if (!fs.existsSync(path.join(p, '.git'))) {
    console.error('Not a git repo')
    process.exit(1)
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

function logBranches(name) {
  const repoACL = acl.getACL(name)
  console.log('Visibility:', '\t', repoACL.visibility)
  console.log('Branch:')
  for (const branch of repoACL.protectedBranches) { console.log(branch) }
}
program.parse()
