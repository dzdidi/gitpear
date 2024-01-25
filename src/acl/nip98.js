const { nip98, nip19, finalizeEvent } = require('nostr-tools')

async function getToken({ url, method, data }) {
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
async function getId({ payload, url, method, data }) {
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

// ;(async () => {
//   const repo = 'gitpear'
//   const url = `pear://d1672d338b8e24223cd0dc6c6b5e04ebabf091fc2b470204abdb98fa5fc59072/${repo}`
//   const commit = '1837a4bae8497f71fb8f01305c3ace1e3dedcdba'
//   const method = 'push'
//   const branch = 'test'
//   const data = `${branch}#${commit}`
//
//   let payload
//   let npub
//
//   payload = await getToken({ url, method, data })
//   npub = await getId({ payload, url, method, data })
//
//   payload = await getToken({url, method: 'get-repos'})
//   npub = await getId({ payload, url, method: 'get-repos' })
//
//   payload = await getToken({url, method: 'get-refs', data: { repo }})
//   npub = await getId({ payload, url, method: 'get-refs', data: { repo }})
// })()
