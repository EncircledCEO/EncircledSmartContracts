const { ethers, upgrades } = require("hardhat");
const { verify } = require("../utils/verify");

async function main() {
  const ENCDUpg = await ethers.getContractFactory("EncircledUpgradable");

  console.log("Deploying EncircledUpgradable...");
  const args = [];
  const encdupg = await upgrades.deployProxy(ENCDUpg, args, {
    initializer: "initialize",
  });
  await encdupg.deployed();

  console.log("EncircledUpgradable deployed to:", encdupg.address);
}

main();
