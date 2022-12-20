const { network } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const chainId = network.config.chainId;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  args = [];

  const token = await deploy("BEP20USDT", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.waitConfirmations || 1,
  });
};

module.exports.tags = ["all", "usdt"];
