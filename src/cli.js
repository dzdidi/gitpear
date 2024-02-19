#!/usr/bin/env node

const { spawn } = require('child_process')

const commander = require('commander')
const program = new commander.Command()

const path = require('path')

const home = require('./home')
const git = require('./git')

const { listRemote } = require('./rpc-requests')

const { checkIfGitRepo } = require('./utils')
const { remoteACL, share, remoteBranchProtectionRules, localACL, localBranchProtectionRules } = require('./cli-helpers')

const pkg = require('../package.json')

const gitPear = program
  .name('git pear')
  .description('CLI to gitpear')
  .usage('<command> [options]')
  .version(pkg.version)

const commandInit = gitPear
  .command('init')
  .description('initialize a gitpear repo')
  .option('-s, --share [branch]', 'share the repo as public, default false, default branch is current', '')
  .action(async (options) => {
    const fullPath = path.resolve('.')
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

const commandShare = gitPear
  .command('share')
  .description('share a gitpear repo')
  .option('-b, --branch [b]', 'branch to share, default is current branch', '')
  .option('-v, --visibility [v]', 'visibility of the repo', 'public')
  .action(async (options) => {
    const fullPath = path.resolve('.')
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

const commandACL = gitPear
  .command('acl')
  .description('manage acl of a gitpear repo')
  .option('-u, --user', 'user to add/remove/list')
  .option('-b, --branch', 'branch to add/remove/list in protected branches')
  .option('-p, --path [path]', 'path to the repo', '.')
  .addArgument(new commander.Argument('[a]', 'actiont to perform').choices(['add', 'remove', 'list']).default('list'))
  .addArgument(new commander.Argument('[n]', 'user or branch to add/remove/list').default(''))
  .action(async (a, n, options) => {
    if (options.user === options.branch) commandACL.help()

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

const commandUnshare = gitPear
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

const commandList = gitPear
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

const commandKey = gitPear
  .command('key')
  .description('get a public key of gitpear')
  .action((p, options) => {
    console.log('Public key:', home.readPk())
  })

const commandDaemon = gitPear
  .command('daemon')
  .description('start/stop gitpear daemon')
  .option('-s, --start', 'start daemon')
  .option('-k, --stop', 'stop daemon')
  .option('-a, --attach', 'watch daemon logs')
  .action((p, options) => {
    if (options.opts().start === options.opts().stop) commandDaemon.help()

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
        opts.stdio = ['ignore', home.getOutStream(), home.getErrStream()]
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

gitPear.parse()
