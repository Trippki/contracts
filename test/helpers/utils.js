function isException(error) {
  let strError = error.toString()
  return strError.includes('invalid opcode') || strError.includes('invalid JUMP') || strError.includes('revert')
}

function ensuresException(error) {
  assert(isException(error), error.toString())
}

/** Returns last block's timestamp */
function getBlockNow() {
  return web3.eth.getBlock(web3.eth.blockNumber).timestamp // base timestamp off the blockchain
}

function assertRevert(error) {
  assert.isAbove(error.message.search('revert'), -1, 'Error containing "revert" must be returned');
}

const BigNumber = web3.BigNumber
const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should()

module.exports = {
  isException,
  ensuresException,
  getBlockNow,
  should,
  assertRevert
}
