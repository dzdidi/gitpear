#!/usr/bin/env node

const { spawn } = require('child_process')

const commander = require('commander')
const program = new commander.Command()

const path = require('path')
const fs = require('fs')

const appHome = require('./appHome')
const git = require('./git')

const pkg = require('../package.json')
program
  .name('gitpear-cli')
  .description('CLI to gitpear')
  .version(pkg.version)

program
  .command('init')
  .description('initialize a gitpear repo')
  .addArgument(new commander.Argument('[p]', 'path to the repo').default('.'))
  .option('-s, --share', 'share the repo, default false')
  .action(async (p, options) => {
    const fullPath = path.resolve(p)
    if (!fs.existsSync(path.join(fullPath, '.git'))) {
      console.error('Not a git repo')
      process.exit(1)
    }

    const name = fullPath.split(path.sep).pop()
    if ((appHome.isInitialized(name))) {
      console.error(`${name} is already initialized`)
      process.exit(1)
    }

    appHome.createAppFolder(name)
    console.log(`Added project "${name}" to gitpear`)
    await git.createBareRepo(name)
    console.log(`Created bare repo for "${name}"`)
    await git.addRemote(name)
    console.log(`Added git remote for "${name}" as "pear"`)

    if (options.share) {
      appHome.shareAppFolder(name)
      console.log(`Shared "${name}" project`)
      // push?
    }
  })

program
  .command('share')
  .description('share a gitpear repo')
  .addArgument(new commander.Argument('[p]', 'path to the repo').default('.'))
  .action(async (p, options) => {
    const name = path.resolve(p).split(path.sep).pop()
    if ((appHome.isInitialized(name))) {
      appHome.shareAppFolder(name)
      console.log(`Shared "${name}" project`)
      return
    }

    console.error(`${name} is not initialized`)
    process.exit(1)
  })

program
  .command('unshare')
  .description('unshare a gitpear repo')
  .addArgument(new commander.Argument('[p]', 'path to the repo').default('.'))
  .action((p, options) => {
    const name = path.resolve(p).split(path.sep).pop()
    if ((appHome.isInitialized(name))) {
      appHome.unshareAppFolder(name)
      console.log(`Unshared "${name}" project`)

      return
    }

    console.error(`${name} is not initialized`)
    process.exit(1)
  })

program
  .command('list')
  .description('list all gitpear repos')
  .option('-s, --shared', 'list only shared repos')
  .action((p, options) => {
    appHome.list(options.opts().shared).forEach(name => console.log(name))
  })

program
  .command('key')
  .description('get a public key of gitpear')
  .action((p, options) => {
    console.log('Public key:', appHome.readPk())
  })

program
  .command('daemon')
  .description('start/stop gitpear daemon')
  .option('-s, --start', 'start daemon')
  .option('-k, --stop', 'stop daemon')
  .action((p, options) => {
    if (options.opts().start) {
      if (appHome.getDaemonPid()) {
        console.error('Daemon already running with PID:', appHome.getDaemonPid())
        process.exit(1)
      }

      const daemon = spawn('gitpeard', {
        detached: true,
        stdio: [
          'ignore',
          appHome.getOutStream(),
          appHome.getErrStream()
        ]
      })
      console.log('Daemon started. Process ID:', daemon.pid)
      appHome.storeDaemonPid(daemon.pid)
      daemon.unref()
    } else if (options.opts().stop) {
      if (!appHome.getDaemonPid()) {
        console.error('Daemon not running')
        process.exit(1)
      }

      const pid = appHome.getDaemonPid()
      process.kill(pid)

      appHome.removeDaemonPid()
      console.log('Daemon stopped. Process ID:', pid)
    } else {
      console.error('No option provided')
      process.exit(1)
    }
  })

program.parse()
