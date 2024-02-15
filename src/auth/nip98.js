const { nip98, nip19, finalizeEvent } = require('nostr-tools')

async function getToken ({ url, method, data }) {
  if (!process.env.GIT_PEAR_AUTH_NSEC) throw new Error('Missing NSEC')
  const { data: sK } = nip19.decode(process.env.GIT_PEAR_AUTH_NSEC)
  return nip98.getToken(
    url,
    method,
    (e) => finalizeEvent(e, sK),
    false,
    data
  )
}

// FIXME
async function getId ({ payload, url, method, data }) {
  const event = JSON.parse(Buffer.from(payload, 'base64').toString())
  const isValid = await nip98.validateEvent(event, url, method, data)
  if (!isValid) throw new Error('Invalid event')
  return {
    ...event,
    userId: nip19.npubEncode(event.pubkey)
  }
}

module.exports = {
  getId,
  getToken
}
