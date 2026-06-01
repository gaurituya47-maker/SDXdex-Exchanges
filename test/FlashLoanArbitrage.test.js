const { expect } = require("chai");
const { ethers } = require("hardhat");

const AAVE_PROVIDER_ADDRESS = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e";
const UNI_V2_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

describe("FlashLoanArbitrage", function () {
  let owner;
  let other;
  let flashLoanArbitrage;
  let mockRouter;
  let aavePoolAddress;

  before(async function () {
    [owner, other] = await ethers.getSigners();

    const providerContract = await ethers.getContractAt(
      ["function getPool() view returns (address)"],
      AAVE_PROVIDER_ADDRESS
    );
    aavePoolAddress = await providerContract.getPool();

    const MockSwapRouters = await ethers.getContractFactory("MockUniswapV2Router");
    mockRouter = await MockSwapRouters.deploy();
    await mockRouter.waitForDeployment();

    await ethers.provider.send("hardhat_setBalance", [owner.address, "0x8ac7230489e80000"]);
    await ethers.provider.send("hardhat_setCode", [UNI_V2_ROUTER_ADDRESS, await ethers.provider.getCode(mockRouter.target)]);

    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
    flashLoanArbitrage = await FlashLoanArbitrage.deploy(AAVE_PROVIDER_ADDRESS);
    await flashLoanArbitrage.waitForDeployment();
  });

  it("Should deploy successfully", async function () {
    expect(ethers.isAddress(flashLoanArbitrage.target)).to.equal(true);
  });

  it("Should reject non-owner executeArbitrage", async function () {
    const params = {
      tokenBorrow: ethers.ZeroAddress,
      tokenTarget: ethers.ZeroAddress,
      borrowAmount: 0n,
      buyDex: 0,
      sellDex: 0,
      v3FeeBuy: 3000,
      v3FeeSell: 3000,
      minProfit: 0n,
    };

    await expect(
      flashLoanArbitrage.connect(other).executeArbitrage(params)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should revert if no profit opportunity", async function () {
    await ethers.provider.send("hardhat_impersonateAccount", [aavePoolAddress]);
    const poolSigner = await ethers.provider.getSigner(aavePoolAddress);
    await ethers.provider.send("hardhat_setBalance", [aavePoolAddress, "0x8ac7230489e80000"]);

    const params = new ethers.AbiCoder().encode(
      [
        "tuple(address,address,uint256,uint8,uint8,uint24,uint24,uint256)"
      ],
      [
        [
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          0n,
          0,
          0,
          3000,
          3000,
          0n,
        ]
      ]
    );

    await expect(
      poolSigner.sendTransaction({
        to: flashLoanArbitrage.target,
        data: flashLoanArbitrage.interface.encodeFunctionData("executeOperation", [
          ethers.ZeroAddress,
          1n,
          0n,
          flashLoanArbitrage.target,
          params,
        ]),
      })
    ).to.be.revertedWith("InsufficientProfit");

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [aavePoolAddress]);
  });

  it("Should execute arbitrage and emit event", async function () {
    await ethers.provider.send("hardhat_impersonateAccount", [aavePoolAddress]);
    const poolSigner = await ethers.provider.getSigner(aavePoolAddress);
    await ethers.provider.send("hardhat_setBalance", [aavePoolAddress, "0x8ac7230489e80000"]);

    const encodedParams = new ethers.AbiCoder().encode(
      [
        "tuple(address,address,uint256,uint8,uint8,uint24,uint24,uint256)"
      ],
      [
        [
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          1000n,
          0,
          0,
          3000,
          3000,
          1n,
        ]
      ]
    );

    const tx = await poolSigner.sendTransaction({
      to: flashLoanArbitrage.target,
      data: flashLoanArbitrage.interface.encodeFunctionData("executeOperation", [
        ethers.ZeroAddress,
        1000n,
        90n,
        flashLoanArbitrage.target,
        encodedParams,
      ]),
    });

    const receipt = await tx.wait();
    expect(receipt.logs.length).to.be.greaterThan(0);
    const eventFound = receipt.logs.some((log) => log.topics[0] === flashLoanArbitrage.interface.getEventTopic("ArbitrageExecuted"));
    expect(eventFound).to.be.true;

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [aavePoolAddress]);
  });

  it("Should allow owner to withdraw tokens", async function () {
    const MockToken = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockToken.deploy("Mock Token", "MCK", 18, 1000000n * 10n ** 18n);
    await mockToken.waitForDeployment();

    await mockToken.transfer(flashLoanArbitrage.target, 1000n * 10n ** 18n);
    await expect(flashLoanArbitrage.withdrawToken(mockToken.target)).to.not.be.reverted;
    expect(await mockToken.balanceOf(owner.address)).to.equal(1000n * 10n ** 18n);
  });
});
