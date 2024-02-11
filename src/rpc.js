const ProtomuxRPC = require('protomux-rpc')
const SecretStream = require('@hyperswarm/secret-stream')
const { spawn } = require('child_process')
const home = require('./home')
const auth = require('./auth')
const { git, acl, bpr } = require('./rpc-handlers')

module.exports = class RPC {
  constructor (announcedRefs, repositories, drives) {
    this.connections = {}
    this.announcedRefs = announcedRefs
    this.repositories = repositories
    this.drives = drives
  }

  async setHandlers (socket, peerInfo) {
    if (this.connections[peerInfo.publicKey]) return this.connections[peerInfo.publicKey]
    const rpc = new ProtomuxRPC(socket)
    this.connections[peerInfo.publicKey] = rpc

    rpc.on('error', err => console.error('rpc error', err))
    rpc.on('close', () => delete this.connections[peerInfo.publicKey])
    // XXX: handshaking can be used for access and permission management
    // for example check of peerInfo.publicKey is in a list of allowed keys
    // which can in turn be stored in a .git-daemon-export-ok file

    /* -- PULL HANDLERS -- */
    rpc.respond('get-repos', async req => await git.getReposHandler.bind(this)(socket.remotePublicKey, req))
    rpc.respond('get-refs',  async req => await git.getRefsHandler.bind(this)(socket.remotePublicKey, req))

    if (!process.env.GIT_PEAR_AUTH) return

    /* -- PUSH HANDLERS -- */
    rpc.respond('push',     async req => await git.pushHandler.bind(this)(socket.remotePublicKey, req))
    rpc.respond('f-push',   async req => await git.forcePushHandler.bind(this)(socket.remotePublicKey, req))
    rpc.respond('d-branch', async req => await git.deleteBranchHandler.bind(this)(socket.remotePublicKey, req))

    /* -- REPO ADMINISTRATION HANDLERS -- */

    /* -- ACL HANDLERS -- */
    rpc.respond('get-acl', async req => await acl.getACLHandler.bind(this)(socket.remotePublicKey, req))
    rpc.respond('add-acl', async req => await acl.addACLHandler.bind(this)(socket.remotePublicKey, req))
    rpc.respond('chg-acl', async req => await acl.chgCLHandler.bind(this)(socket.remotePublicKey, req))
    rpc.respond('del-acl', async req => await acl.delACLHandler.bind(this)(socket.remotePublicKey, req))
    /* -- BRANCH HANDLERS -- */
    rpc.respond('get-bpr', async req => await bpr.getBPRHandler.bind(this)(socket.remotePublicKey, req))
    rpc.respond('add-bpr', async req => await bpr.addBPRHandler.bind(this)(socket.remotePublicKey, req))
    rpc.respond('del-bpr', async req => await bpr.delBPRHandler.bind(this)(socket.remotePublicKey, req))
  }

  async authenticate (publicKey, request) {
    if (!process.env.GIT_PEAR_AUTH) return publicKey.toString('hex')
    if (process.env.GIT_PEAR_AUTH === 'native') return publicKey.toString('hex')
    if (!request.header) throw new Error('You are not allowed to access this repo')

    return (await auth.getId({ ...request.body, payload: request.header })).userId
  }
}
