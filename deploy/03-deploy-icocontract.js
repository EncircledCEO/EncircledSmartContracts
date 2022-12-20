const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  let USCToken,
    USCTokenAddress,
    Encircled,
    EncircledAddress,
    Vesting,
    VestingAddress;

  USCToken = await ethers.getContract("BEP20USDT");
  USCTokenAddress = USCToken.address;
  Encircled = await ethers.getContract("Encircled");
  EncircledAddress = Encircled.address;
  Vesting = await ethers.getContract("EncdVesting");
  VestingAddress = Vesting.address;

  const arguments = [EncircledAddress, USCTokenAddress, VestingAddress];

  const token = await deploy("ENCD_ICO", {
    from: deployer,
    args: arguments,
    log: true,
    waitConfirmations: network.config.waitConfirmations || 1,
  });

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying...");
    await verify(nftmarketplace.address, args);
  }
  log("----------------------------");
};

module.exports.tags = ["all", "ico"];
