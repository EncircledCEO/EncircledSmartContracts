const { ethers, network, upgrades } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  let USCToken, USCTokenAddress, Encircled, EncircledAddress;
  USCToken = await ethers.getContract("BEP20USDT");
  USCTokenAddress = USCToken.address;
  Encircled = await ethers.getContract("Encircled");
  EncircledAddress = Encircled.address;

  const arguments = [EncircledAddress];

  const token = await deploy("EncdVesting", {
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
    await verify(token.address, args);
  }
  log("----------------------------");
};

module.exports.tags = ["all", "vesting"];
