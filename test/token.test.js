const { ethers, deployments } = require("hardhat");
const { use, assert } = require("chai");
const { solidity } = require("ethereum-waffle");
const {
  abi
} = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");

use(solidity);

const createDeadline = () => {
  return Math.floor(Date.now() / 1000) + 60 * 10; // 20 minutes from the current Unix time
}

async function deploy() {
  const [deployer, marketing, user1, user2, user3, ...accounts] = await ethers.getSigners();

  await deployments.fixture(["MyToken"]);
  const token = await ethers.getContract("MyToken");

  await token.transfer(token.address, ethers.utils.parseUnits("1300000000000.0", 9));
  
  const lpTokens = ethers.utils.parseUnits("85700000000000.0", 9);
  const collateralTokens = ethers.utils.parseUnits("3.5", 18);

  const uniswapAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  await token.approve(uniswapAddress, ethers.constants.MaxUint256);

  const uniswap = await ethers.getContractAt(abi, uniswapAddress);
  await uniswap.addLiquidityETH(
    token.address, 
    lpTokens, 
    lpTokens, 
    collateralTokens, 
    deployer.address, 
    createDeadline(),
    { value: collateralTokens }
  );
  
  await token.setTrading(true);
  await token.setMaxTxnAmount(ethers.utils.parseUnits("100000000000000.0", 9));
  await token.setMaxWalletSize(ethers.utils.parseUnits("100000000000000.0", 9));
  await token.setMarketingAddress(marketing.address);

  return {deployer, marketing, user1, user2, user3, token, uniswap};
}

describe("Token test", function () {
  this.timeout(15000);

  it("Buy", async function () {
    const {deployer, marketing, user1, user2, user3, token, uniswap} = await deploy();

    const amountETH = ethers.utils.parseUnits("1.0", 18);
    const amountTokens = ethers.utils.parseUnits("1.0", 9);
    await token.connect(user1).approve(uniswap.address, ethers.constants.MaxUint256);
    let newBalance = await token.balanceOf(user1.address);

    /*
    console.log("Transfer tokens to user1...")
    await token.connect(deployer).transfer(user1.address, amount);
    console.log("...end transfer");
    */

    console.log("Buy token");
    await uniswap.connect(user1).swapExactETHForTokens(
      0,
      ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", token.address],
      user1.address,
      createDeadline(),
      { value: amountETH }
    );

    newBalance = (await token.balanceOf(user1.address)).sub(newBalance);
    console.log("balance increased of", ethers.utils.formatUnits((newBalance), 9));
    console.log("End buy");

    console.log("Buy token");
    await uniswap.connect(user1).swapExactETHForTokens(
      0,
      ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", token.address],
      user1.address,
      createDeadline(),
      { value: amountETH }
    );

    newBalance = (await token.balanceOf(user1.address)).sub(newBalance);
    console.log("balance increased of", ethers.utils.formatUnits((newBalance), 9));
    console.log("End buy");
  });

  it("Should deploy the token correctly", async function () {
    const {deployer, marketing, user1, token} = await deploy();

    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();
    const userBalance = await token.balanceOf(user1.address);
    
    const supply = ethers.BigNumber.from(10).pow(23);

    assert(name === "My Token", "Token name mismatch");
    assert(symbol === "TKN", "Token symbol mismatch");
    assert(decimals === 9, "Token decimals mismatch");
    assert(totalSupply.eq(supply), "Token totalSupply mismatch");
    assert(userBalance.eq(0), "Token balanceOf mismatch");
  });

  it("Should not allow huge transfers", async function () {
    const {deployer, marketing, user1, user2, token} = await deploy();

    const amount = ethers.utils.parseUnits("1000000000.1", 9);
    await token.connect(deployer).transfer(user1.address, amount);

    try {
      await token.connect(user1).transfer(user2.address, amount);
      assert.fail("Expected transfer exception");
    } catch (e) {} // eslint-disable-line no-empty
  });

  it("Should not apply taxes on transfers", async function () {
    const {deployer, marketing, user1, user2, user3, token} = await deploy();

    const amount = ethers.utils.parseUnits("100.0", 9);

    // Fund user1, user2 and marketing
    await token.transfer(marketing.address, amount);
    await token.transfer(user1.address, amount);
    await token.transfer(user2.address, amount);
    await token.transfer(user3.address, amount);

    const marketingBalanceInitial = await token.balanceOf(marketing.address);
    const user1BalanceInitial = await token.balanceOf(user1.address);
    const user2BalanceInitial = await token.balanceOf(user2.address);
    const user3BalanceInitial = await token.balanceOf(user3.address);

    assert(user1BalanceInitial.eq(user2BalanceInitial), "Transfer error: deployer is exempt from taxes");
    assert(user1BalanceInitial.eq(user3BalanceInitial), "Transfer error: deployer is exempt from taxes");
    assert(user1BalanceInitial.eq(marketingBalanceInitial), "Transfer error: deployer is exempt from taxes");
    assert(user1BalanceInitial.eq(amount), "Transfer error: deployer is exempt from taxes");

    // Transfer between user1 and user2
    await token.connect(user1).transfer(user2.address, amount);

    // Check if user1 has not received any tax
    const user1BalanceAfterTransfer = await token.balanceOf(user1.address);
    assert(user1BalanceAfterTransfer.eq(0), "Transfer error: user1 reflection tax");

    // Check if user2 has not received any tax
    const user2BalanceFinal = await token.balanceOf(user2.address);
    assert(user2BalanceFinal.sub(user2BalanceInitial).eq(amount), "Transfer error: user2 paid tax");

    // Check if user3 has received any tax
    const user3BalanceFinal = await token.balanceOf(user3.address);
    assert(user3BalanceFinal.sub(user3BalanceInitial).eq(0), "Transfer error: user3 paid tax");

    const marketingBalanceFinal = await token.balanceOf(marketing.address);
    assert(marketingBalanceFinal.sub(marketingBalanceInitial).eq(0), "Transfer error: marketing paid tax");

    const totalSupply = await token.totalSupply();
    const supply = ethers.BigNumber.from(10).pow(23);
    assert(totalSupply.eq(supply), "Token totalSupply didn't screw up");
  });

  it("Should not apply taxes on deployer swaps", async function () {
    const {deployer, marketing, user1, user2, user3, token, uniswap} = await deploy();

    const deployerBalanceBeforeSwap = await token.balanceOf(deployer.address);

    const amount = ethers.utils.parseUnits("1.0", 18);
    await uniswap.connect(deployer).swapExactETHForTokens(
      0,
      ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", token.address],
      deployer.address,
      createDeadline(),
      { value: amount }
    );

    const deployerBalanceAfterSwap = await token.balanceOf(deployer.address);

    assert(deployerBalanceAfterSwap.gt(deployerBalanceBeforeSwap), "Swap Error");
  });

  it("Should apply taxes on user swaps", async function () {
    const {deployer, marketing, user1, user2, user3, token, uniswap} = await deploy();

    await token.transfer(user2.address, ethers.utils.parseUnits("1000.0", 9));

    const userBalanceBeforeSwap = await token.balanceOf(user1.address);
    const otherUserBalanceBeforeSwap = await token.balanceOf(user2.address);

    await token.connect(user1).approve(uniswap.address, ethers.constants.MaxUint256);
    const amount = ethers.utils.parseUnits("1.0", 18);
    await uniswap.connect(user1).swapExactETHForTokens(
      0,
      ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", token.address],
      user1.address,
      createDeadline(),
      { value: amount }
    );

    const userBalanceAfterSwap = await token.balanceOf(user1.address);
    const otherUserBalanceAfterSwap = await token.balanceOf(user2.address);

    assert(userBalanceAfterSwap.gt(userBalanceBeforeSwap), "Swap error");
    assert(otherUserBalanceAfterSwap.gt(otherUserBalanceBeforeSwap), "Swap tax error");
  });

  it("Should apply taxes on user swaps and send them to marketing wallet", async function () {
    const {deployer, marketing, user1, user2, user3, token, uniswap} = await deploy();

    const provider = ethers.getDefaultProvider();

    const amount = ethers.utils.parseUnits("1000000000000.0", 9);
    await token.transfer(user1.address, amount);

    const marketingETHBalanceBeforeSwap = await provider.getBalance(deployer.address);

    await token.connect(user1).approve(uniswap.address, ethers.constants.MaxUint256);
    const quotes = await uniswap.getAmountsOut(amount, [token.address, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"]);
    await uniswap.connect(user1).swapExactTokensForTokens(
      amount,
      quotes[1],
      [token.address, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"],
      user1.address,
      createDeadline()
    );

    const marketingETHBalanceAfterSwap = await provider.getBalance(deployer.address);

    console.log("marketingETHBalanceBeforeSwap", marketingETHBalanceBeforeSwap.toString());
    console.log("marketingETHBalanceAfterSwap", marketingETHBalanceAfterSwap.toString());
  });
});
