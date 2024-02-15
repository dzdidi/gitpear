const ACL = require('../acl')
const home = require('../home')
const { spawn } = require('child_process')

async function getReposHandler (publicKey, req) {
  const { userId } = await parseReq.bind(this)(publicKey, req)

  const res = {}
  for (const repoName in this.repositories) {
    const isPublic = (ACL.getACL(repoName).visibility === 'public')
    if (isPublic || ACL.getViewers(repoName).includes(userId)) {
      res[repoName] = this.drives[repoName].key.toString('hex')
    }
  }
  return Buffer.from(JSON.stringify(res))
}

async function getRefsHandler (publicKey, req) {
  const { repoName, userId } = await parseReq.bind(this)(publicKey, req)
  const res = this.repositories[repoName]

  const isPublic = (ACL.getACL(repoName).visibility === 'public')
  if (isPublic || ACL.getViewers(repoName).includes(userId)) {
    return Buffer.from(JSON.stringify(res))
  } else {
    throw new Error('You are not allowed to access this repo')
  }
}

async function pushHandler (publicKey, req) {
  const { url, repoName, branch, userId } = await parseReq.bind(this)(publicKey, req)
  const isContributor = ACL.getContributors(repoName).includes(userId)

  if (!isContributor) throw new Error('You are not allowed to push to this repo')

  const isProtectedBranch = ACL.getACL(repoName).protectedBranches.includes(branch)
  const isAdmin = ACL.getAdmins(repoName).includes(userId)

  if (isProtectedBranch && !isAdmin) throw new Error('You are not allowed to push to this branch')

  return await new Promise((resolve, reject) => {
    const env = { ...process.env, GIT_DIR: home.getCodePath(repoName) }
    const child = spawn('git', ['fetch', url, `${branch}:${branch}`], { env })
    return doGit(child, resolve, reject)
  })
}

async function forcePushHandler (publicKey, req) {
  const { url, repoName, branch, userId } = await parseReq.bind(this)(publicKey, req)
  const isContributor = ACL.getContributors(repoName).includes(userId)

  if (!isContributor) throw new Error('You are not allowed to push to this repo')

  const isProtectedBranch = ACL.getACL(repoName).protectedBranches.includes(branch)
  const isAdmin = ACL.getAdmins(repoName).includes(userId)

  if (isProtectedBranch && !isAdmin) throw new Error('You are not allowed to push to this branch')

  return await new Promise((resolve, reject) => {
    const env = { ...process.env, GIT_DIR: home.getCodePath(repoName) }
    const child = spawn('git', ['fetch', url, `${branch}:${branch}`, '--force'], { env })
    return doGit(child, resolve, reject)
  })
}

async function deleteBranchHandler (publicKey, req) {
  const { repoName, branch, userId } = await parseReq.bind(this)(publicKey, req)
  const isContributor = ACL.getContributors(repoName).includes(userId)

  if (!isContributor) throw new Error('You are not allowed to push to this repo')

  const isProtectedBranch = ACL.getACL(repoName).protectedBranches.includes(branch)
  const isAdmin = ACL.getAdmins(repoName).includes(userId)

  if (isProtectedBranch && !isAdmin) throw new Error('You are not allowed to push to this branch')

  return await new Promise((resolve, reject) => {
    const env = { ...process.env, GIT_DIR: home.getCodePath(repoName) }
    const child = spawn('git', ['branch', '-D', branch], { env })
    return doGit(child, resolve, reject)
  })
}

async function parseReq (publicKey, req) {
  if (!req) throw new Error('Request is empty')
  const request = JSON.parse(req.toString())
  const parsed = {
    repoName: request.body.url?.split('/')?.pop(),
    branch: request.body.data?.split('#')[0],
    url: request.body.url,
    userId: await this.authenticate(publicKey, request)
  }
  return parsed
}

function doGit (child, resolve, reject) {
  let errBuffer = Buffer.from('')
  let outBuffer = Buffer.from('')

  child.stdout.on('data', data => {
    outBuffer = Buffer.concat([outBuffer, data])
  })

  child.stderr.on('data', data => {
    errBuffer = Buffer.concat([errBuffer, data])
  })

  child.on('close', code => {
    console.error('errBuffer', errBuffer.toString())
    console.log('outBuffer', outBuffer.toString())

    return code === 0 ? resolve(outBuffer) : reject(errBuffer)
  })
}

module.exports = {
  getReposHandler,
  getRefsHandler,
  pushHandler,
  forcePushHandler,
  deleteBranchHandler
}
