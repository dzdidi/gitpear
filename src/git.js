const { getCodePath } = require('./home')
const { spawn } = require('child_process')

async function getCommit () {
  return await new Promise((resolve, reject) => {
    const process = spawn('git', ['rev-parse', 'HEAD'])
    let outBuffer = Buffer.from('')
    process.stdout.on('data', data => {
      outBuffer = Buffer.concat([outBuffer, data])
    })

    let errBuffer = Buffer.from('')
    process.stderr.on('err', data => {
      errBuffer = Buffer.concat([errBuffer, data])
    })

    process.on('close', code => {
      return code === 0 ? resolve(outBuffer.toString().replace('\n', '')) : reject(errBuffer)
    })
  })
}

async function getCurrentBranch () {
  return await new Promise((resolve, reject) => {
    const process = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
    let outBuffer = Buffer.from('')
    process.stdout.on('data', data => {
      outBuffer = Buffer.concat([outBuffer, data])
    })

    let errBuffer = Buffer.from('')
    process.stderr.on('err', data => {
      errBuffer = Buffer.concat([errBuffer, data])
    })

    process.on('close', code => {
      return code === 0 ? resolve(outBuffer.toString().replace('\n', '')) : reject(errBuffer)
    })
  })
}

async function lsPromise (url) {
  const ls = spawn('git', ['ls-remote', url])
  const res = {}

  ls.stdout.on('data', lines => lines.toString().split('\n').forEach((line) => {
    if (!line) return

    const [sha, branch] = line.split('\t')
    res[branch] = sha
  }))

  return new Promise((resolve, reject) => {
    ls.on('close', (code) => {
      if (!code) return resolve(res)

      reject(new Error(`git ls-remote exited with code ${code}`))
    })
  })
}

async function createBareRepo (name) {
  const init = spawn('git', ['init', '--bare'], { env: { GIT_DIR: getCodePath(name) } })
  return await doGit(init)
}

async function addRemote (name, opts = { quiet: false }) {
  const init = spawn('git', ['remote', 'add', 'pear', getCodePath(name)])
  return await doGit(init, opts)
}

async function push (branch = 'master', force = false) {
  const args = ['push', 'pear', branch]
  if (force) args.push('-f')
  const push = spawn('git', args)
  return await doGit(push)
}

async function doGit (child, opts = { quiet: false }) {
  if (!opts.quiet) child.stderr.pipe(process.stderr)
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code) {
        return reject(new Error(`git exited with code ${code}`))
      }

      return resolve()
    })
  })
}

function pad4 (num) {
  num = num.toString(16)
  while (num.length < 4) {
    num = '0' + num
  }
  return num
}

function uploadPack (dir, want, have) {
  // reference:
  // https://github.com/git/git/blob/b594c975c7e865be23477989d7f36157ad437dc7/Documentation/technical/pack-protocol.txt#L346-L393
  const upload = spawn('git-upload-pack', [dir])
  writeln('want ' + want)
  writeln()
  if (have) {
    writeln('have ' + have)
    writeln()
  }
  writeln('done')

  // We want to read git's output one line at a time, and not read any more
  // than we have to. That way, when we finish discussing wants and haves, we
  // can pipe the rest of the output to a stream.
  //
  // We use `mode` to keep track of state and formulate responses. It returns
  // `false` when we should stop reading.
  let mode = list
  upload.stdout.on('readable', function () {
    while (true) {
      const line = getline()
      if (line === null) {
        return // to wait for more output
      }
      if (!mode(line)) {
        upload.stdout.removeAllListeners('readable')
        upload.emit('ready')
        return
      }
    }
  })

  let getLineLen = null
  // Extracts exactly one line from the stream. Uses `getLineLen` in case the
  // whole line could not be read.
  function getline () {
    // Format: '####line' where '####' represents the length of 'line' in hex.
    if (!getLineLen) {
      getLineLen = upload.stdout.read(4)
      if (getLineLen === null) {
        return null
      }
      getLineLen = parseInt(getLineLen, 16)
    }

    if (getLineLen === 0) {
      return ''
    }

    // Subtract by the four we just read, and the terminating newline.
    const line = upload.stdout.read(getLineLen - 4 - 1)
    if (!line) {
      return null
    }
    getLineLen = null
    upload.stdout.read(1) // And discard the newline.
    return line.toString()
  }

  // First, the server lists the refs it has, but we already know from
  // `git ls-remote`, so wait for it to signal the end.
  function list (line) {
    if (line === '') {
      mode = have ? ackObjectsContinue : waitForNak
    }
    return true
  }

  // If we only gave wants, git should respond with 'NAK', then the pack file.
  function waitForNak (line) {
    return line !== 'NAK'
  }

  // With haves, we wait for 'ACK', but only if not ending in 'continue'.
  function ackObjectsContinue (line) {
    return !(line.search(/^ACK/) !== -1 && line.search(/continue$/) === -1)
  }

  // Writes one line to stdin so git-upload-pack can understand.
  function writeln (line) {
    if (line) {
      const len = pad4(line.length + 4 + 1) // Add one for the newline.
      upload.stdin.write(len + line + '\n')
    } else {
      upload.stdin.write('0000')
    }
  }

  return upload
}

async function unpackFile (file, path) {
  const unpack = spawn('git', ['index-pack', '-v', file, '-o', path])
  unpack.stderr.pipe(process.stderr)

  return new Promise((resolve, reject) => {
    unpack.on('exit', (code) => {
      // These writes are actually necessary for git to finish checkout.
      process.stdout.write('\n\n')
      if (code) return reject(code)

      return resolve()
    })
  })
}

async function unpackStream (packStream) {
  const unpack = spawn('git', ['index-pack', '--stdin', '-v', '--fix-thin'])
  unpack.stderr.pipe(process.stderr)

  packStream.pipe(unpack.stdin)

  return new Promise((resolve, reject) => {
    unpack.on('exit', (code) => {
      // These writes are actually necessary for git to finish checkout.
      if (code) return reject(code)

      return resolve()
    })
  })
}

module.exports = {
  lsPromise,
  uploadPack,
  unpackFile,
  unpackStream,
  createBareRepo,
  addRemote,
  push,
  getCommit,
  getCurrentBranch
}
