#!/usr/bin/env node

const { spawn } = require('child_process')

const commander = require('commander')
const program = new commander.Command()

const path = require('path')
const fs = require('fs')

const home = require('./home')
const git = require('./git')

const pkg = require('../package.json')
program
  .name('gitpear')
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
    if ((home.isInitialized(name))) {
      console.error(`${name} is already initialized`)
      process.exit(1)
    }

    home.createAppFolder(name)
    console.log(`Added project "${name}" to gitpear`)
    await git.createBareRepo(name)
    console.log(`Created bare repo for "${name}"`)
    await git.addRemote(name)
    console.log(`Added git remote for "${name}" as "pear"`)

    if (options.share) {
      home.shareAppFolder(name)
      await git.push()
      console.log(`Shared "${name}" project`)
    }
  })

program
  .command('share')
  .description('share a gitpear repo')
  .addArgument(new commander.Argument('[p]', 'path to the repo').default('.'))
  .action(async (p, options) => {
    const name = path.resolve(p).split(path.sep).pop()
    if ((home.isInitialized(name))) {
      home.shareAppFolder(name)
      await git.push()
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
  .option('-s, --shared', 'list only shared repos')
  .action((p, options) => {
    const k = home.readPk()
    const s = options.opts().shared
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
  .action((p, options) => {
    if (options.opts().start) {
      // TODO: check if it is a first run (.mnemonic exists)
      // if not =>
      //   ask for mnemonic or propose to generate it
      //   if mnemonic is provided - check
      //     - if valid mnemonic
      //     - if not used mnemonic
      //        to avoid killing hypercore due to multiple key instances
      //        using ephemeral key try to access hypercore with key
      //        generated from supplied valid mnemonic
      //  if yes => use it
      if (home.getDaemonPid()) {
        console.error('Daemon already running with PID:', home.getDaemonPid())
        process.exit(1)
      }

      const daemon = spawn('gitpeard', {
        detached: true,
        stdio: [
          'ignore',
          home.getOutStream(),
          home.getErrStream()
        ]
      })
      console.log('Daemon started. Process ID:', daemon.pid)
      home.storeDaemonPid(daemon.pid)
      daemon.unref()
    } else if (options.opts().stop) {
      if (!home.getDaemonPid()) {
        console.error('Daemon not running')
        process.exit(1)
      }

      const pid = home.getDaemonPid()
      try {
        process.kill(pid)
      } catch (e) {
        if (e.code !== 'ESRCH') throw e
      }

      home.removeDaemonPid()
      console.log('Daemon stopped. Process ID:', pid)
    } else {
      console.error('No option provided')
      process.exit(1)
    }
  })

program.parse()
