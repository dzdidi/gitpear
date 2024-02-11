const ACL = require('../acl')

async function getBPRHandler (publicKey, req) {
}

async function addBPRHandler (publicKey, req) {
}

async function delBPRHandler (publicKey, req) {
}

async function parseBPRRequest(publicKey, req) {
  if (!req) throw new Error('Request is empty')
  const request = JSON.parse(req.toString())
  const userId = await this.authenticate(publicKey, request)

  const isOwner = ACL.getOwnder(repoName).includes(userId)
  if (!isOwner) throw new Error('You are not allowed to access this repo')

  const repoName = request.body.url?.split('/')?.pop()
  // TODO: check if repo exists

  return {
    repoName,
    userId,
    // FIXME
    acl: request.body.acl,
  }
}

module.exports = {
  getBPRHandler,
  addBPRHandler,
  delBPRHandler,
}
