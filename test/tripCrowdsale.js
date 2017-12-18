const TRIPCrowdsale = artifacts.require('./TRIPCrowdsale.sol')
const TRIPToken = artifacts.require('./TRIPToken.sol')

import { should, ensuresException, getBlockNow, assertRevert } from './helpers/utils'
import timer from './helpers/timer'

const BigNumber = web3.BigNumber

contract('TRIPCrowdsale', ([owner, wallet, wallet2, wallet3, buyer, buyer2, advisor1, advisor2]) => {
  const rate = new BigNumber(50)
  const newRate = new BigNumber(70000000)
  const dayInSecs = 86400
  const value = new BigNumber(1e18)
  const crowdsaleHardCapInWei = new BigNumber(1005e18)
  const crowdsaleSoftCapInWei = new BigNumber(50e18)
  const preSaleCapInWei = new BigNumber(1002e18)

  const expectedCompanyTokens = new BigNumber(20000000e18)
  const expectedBountyTokens = new BigNumber(20000000e18)
  const expectedTokenSupply = new BigNumber(200000000e18)
  const expectedTokensAtVault = new BigNumber(80000000e18)

  let startTime, presaleEndTime, endTime
  let crowdsale, token

  const newCrowdsale = rate => {
    startTime = getBlockNow() + 20 // crowdsale starts in 20 seconds
    presaleEndTime = startTime + dayInSecs * 20 // 20 days
    endTime = startTime + dayInSecs * 60 // 60 days

    return TRIPCrowdsale.new(
      startTime,
      presaleEndTime,
      endTime,
      rate,
      crowdsaleHardCapInWei,
      crowdsaleSoftCapInWei,
      preSaleCapInWei,
      wallet,
      wallet2,
      wallet3
    )
  }

  beforeEach('initialize contract', async () => {
    crowdsale = await newCrowdsale(rate)
    token = TRIPToken.at(await crowdsale.token())
  })

  it('has a normal crowdsale rate', async () => {
    const crowdsaleRate = await crowdsale.rate()
    crowdsaleRate.toNumber().should.equal(rate.toNumber())
  })

  it('starts with token paused', async () => {
    const paused = await token.paused()
    paused.should.be.true
  })

  it('has a hard cap', async () => {
    const hardCap = await crowdsale.crowdsaleHardCapInWei()
    hardCap.should.be.bignumber.equal(crowdsaleHardCapInWei)
  })

  it('has a soft cap', async () => {
    const softCap = await crowdsale.crowdsaleSoftCapInWei()
    softCap.should.be.bignumber.equal(crowdsaleSoftCapInWei)
  })

  it('has a pre sale cap', async () => {
    const preSaleCap = await crowdsale.preSaleCapInWei()
    preSaleCap.should.be.bignumber.equal(preSaleCapInWei)
  })

  it('assigns remaining tokens to vault if not all tokens are sold during crowdsale', async function() {
    crowdsale = await newCrowdsale(newRate) // 70M
    token = TRIPToken.at(await crowdsale.token())
    const vaultAddress = await crowdsale.vault()

    await timer(dayInSecs * 42)

    await crowdsale.buyTokens(buyer, { value, from: buyer })

    await timer(endTime + 30)
    await crowdsale.finalize()

    const balance = await token.balanceOf(vaultAddress)
    balance.should.be.bignumber.equal(expectedTokensAtVault.add(10000000e18))

    const buyerBalance = await token.balanceOf(buyer)
    buyerBalance.should.be.bignumber.equal(70000000e18)

    const totalSupply = await token.totalSupply()
    totalSupply.should.be.bignumber.equal(expectedTokenSupply)
  })

  describe('token purchases plus their bonuses', () => {
    it('does NOT buy tokens if crowdsale is paused', async () => {
      await timer(dayInSecs * 42)
      await crowdsale.pause()
      let buyerBalance

      try {
        await crowdsale.buyTokens(buyer, { value })
        assert.fail()
      } catch (e) {
        assertRevert(e)
      }

      buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(0)

      await crowdsale.unpause()
      await crowdsale.buyTokens(buyer, { value })

      buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(50e18)
    })

    it('does not participate in presale if sending less than 20 ether', async () => {
      await timer(50) // within presale period
      try {
        await crowdsale.buyTokens(buyer2, { value })
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      const buyerBalance = await token.balanceOf(buyer2)
      buyerBalance.should.be.bignumber.equal(0)
    })

    it('has bonus of 2% during the presale', async () => {
      await timer(50) // within presale period
      await crowdsale.buyTokens(buyer2, { from: wallet2, value: 20e18 })

      const buyerBalance = await token.balanceOf(buyer2)
      buyerBalance.should.be.bignumber.equal(1020e18) // 2% bonus
    })

    it('has bonus of 5% during the presale', async () => {
      await timer(50) // within presale period
      await crowdsale.buyTokens(buyer2, { value: 100e18 })

      const buyerBalance = await token.balanceOf(buyer2)
      buyerBalance.should.be.bignumber.equal(5250e18) // 5% bonus
    })

    it('has bonus of 10% during the presale', async () => {
      await timer(50) // within presale period
      await crowdsale.buyTokens(buyer2, { value: 400e18 })

      const buyerBalance = await token.balanceOf(buyer2)
      buyerBalance.should.be.bignumber.equal(22000e18) // 10% bonus
    })

    it('has bonus of 15% during the presale', async () => {
      await timer(50) // within presale period
      await crowdsale.buyTokens(buyer2, { value: 1000e18 })

      const buyerBalance = await token.balanceOf(buyer2)
      buyerBalance.should.be.bignumber.equal(57500e18) // 15% bonus
    })

    it('stops presale once the presaleCap is reached', async () => {
      await timer(50) // within presale period

      await crowdsale.buyTokens(buyer2, { from: wallet, value: 20e18 })

      try {
        await crowdsale.buyTokens(buyer, { value })
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      const buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(0)
    })

    it('provides 0% bonus during crowdsale period', async () => {
      timer(dayInSecs * 42)
      await crowdsale.buyTokens(buyer2, { value })

      const buyerBalance = await token.balanceOf(buyer2)
      buyerBalance.should.be.bignumber.equal(50e18) // 0% bonus
    })

    it('is also able to buy tokens with bonus by sending ether to the contract directly', async () => {
      await timer(dayInSecs * 42)
      await crowdsale.sendTransaction({ from: buyer, value })

      const purchaserBalance = await token.balanceOf(buyer)
      purchaserBalance.should.be.bignumber.equal(50e18)
    })

    it('stops crowdsale once the hardCap is reached', async () => {
      await timer(dayInSecs * 42)

      await crowdsale.buyTokens(buyer2, { from: advisor1, value: crowdsaleHardCapInWei })

      try {
        await crowdsale.buyTokens(buyer, { from: advisor1, value })
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      const buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(50250e18)

      const buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(0)
    })

    it('stops crowdsale 48 hours after the softCap is reached', async () => {
      await timer(dayInSecs * 42)
      await crowdsale.buyTokens(buyer2, { from: advisor2, value: crowdsaleSoftCapInWei })
      await timer(dayInSecs * 2.1)

      try {
        await crowdsale.buyTokens(buyer, { from: advisor2, value })
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      const buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(2.5e21)

      const buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(0)
    })

    it('is able to buy tokens within 48 hours after the softCap is reached', async () => {
      await timer(dayInSecs * 42)
      await crowdsale.buyTokens(buyer2, { from: advisor2, value: crowdsaleSoftCapInWei })
      await timer(dayInSecs * 1)
      await crowdsale.buyTokens(buyer, { from: advisor2, value })

      const buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(2.5e21)

      const buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(50e18)
    })
  })

  describe('crowdsale finalization', function () {
    beforeEach(async function() {
      const rateThatReachesCrowdsaleTokenSupply = new BigNumber(80000000)
      crowdsale = await newCrowdsale(rateThatReachesCrowdsaleTokenSupply)
      token = TRIPToken.at(await crowdsale.token())

      await timer(dayInSecs * 42)

      await crowdsale.buyTokens(buyer, { value })

      await timer(dayInSecs * 20)
      await crowdsale.finalize()
    })

    it('assigns tokens correctly to company', async function() {
      const balanceCompany = await token.balanceOf(wallet)

      balanceCompany.should.be.bignumber.equal(expectedCompanyTokens)
    })

    it('assigns tokens correctly to bounty campaign', async function() {
      const bountyWalletAddress = await crowdsale.bountyWallet()
      const balanceBounty = await token.balanceOf(bountyWalletAddress)

      balanceBounty.should.be.bignumber.equal(expectedBountyTokens)
    })

    it('finishes token minting', async function() {
      const finishMinting = await token.mintingFinished()
      finishMinting.should.be.true
    })

    it('token is unpaused after crowdsale ends', async function() {
      let paused = await token.paused()
      paused.should.be.false
    })

    it('assigns tokens correctly to vault ', async function() {
      const vaultAddress = await crowdsale.vault()

      const balance = await token.balanceOf(vaultAddress)
      balance.should.be.bignumber.equal(expectedTokensAtVault)
    })
  })

  describe('remainder', function () {
    beforeEach(async function() {
      crowdsale = await newCrowdsale(newRate) // 70M
      token = TRIPToken.at(await crowdsale.token())

      await timer(dayInSecs * 42)

      await crowdsale.buyTokens(buyer, { value }) // purchase the first 70M tokens
    })

    it('sells up to token supply for the crowdsale', async function() {
      await crowdsale.buyTokens(buyer2, { from: wallet2, value })

      const buyerBalance = await token.balanceOf(buyer2)
      buyerBalance.should.be.bignumber.equal(10000000e18) // 10M which was left for the token sale after the first purchase
    })

    it('sends back wei remainder to sender when token purchases goes over token supply for crowdsale', async function() {
      const walletBalance = web3.eth.getBalance(wallet2).toNumber()
      await crowdsale.buyTokens(buyer2, { from: wallet2, value })

      const purchaseofTokensInWei = 10000000e18 / newRate // number of tokens
      const estimatedWalletBalanceAfterPurchasingTokens = walletBalance - purchaseofTokensInWei

      const walletBalancePostTokenPurchase = web3.eth.getBalance(wallet2).toNumber()
      walletBalancePostTokenPurchase.should.be.approximately(estimatedWalletBalanceAfterPurchasingTokens, 1e16)
    })
  })
})
