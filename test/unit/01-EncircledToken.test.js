const { expect } = require("chai");
const { network, deployments, ethers, time } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");
const { tokenConfig } = require("../../hardhat-token-config");

const tokenName = tokenConfig.name;
const symbol = tokenConfig.symbol;
const initialSupply = tokenConfig.initialSupply;
const decimals = tokenConfig.decimals;

let credit = async function (to, amount) {
  return await tokenContract.transfer(to.address, amount);
};

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Token Unit Tests", function () {
      beforeEach(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        alice = accounts[1];
        bob = accounts[2];
        charles = accounts[3];
        await deployments.fixture(["all"]);

        tokenContract = await ethers.getContract("Encircled");
        tokenContract = tokenContract.connect(deployer);
        tokenContractAlice = tokenContract.connect(alice);
        tokenContractBob = tokenContract.connect(bob);
        tokenContractCharles = tokenContract.connect(charles);
      });
      describe("ERC-20", function () {
        describe("Initalization()", function () {
          it("should have the name " + tokenName, async function () {
            expect(await tokenContract.name()).to.equal(tokenName);
          });
          it("should have the symbol " + symbol, async function () {
            expect(await tokenContract.symbol()).to.equal(symbol);
          });
          it(
            "should have initial supply of " + initialSupply,
            async function () {
              expect(await tokenContract.totalSupply()).to.equal(initialSupply);
            }
          );
          it("should have " + decimals + " decimals", async function () {
            expect(await tokenContract.decimals()).to.equal(decimals);
          });
        });

        describe("Balances()", function () {
          it("should have correct initial balance", async function () {
            expect(await tokenContract.balanceOf(deployer.address)).to.equal(
              initialSupply
            );
            expect(await tokenContract.balanceOf(alice.address)).to.equal(0);
            expect(await tokenContract.balanceOf(bob.address)).to.equal(0);
            expect(await tokenContract.balanceOf(charles.address)).to.equal(0);
          });
          it("should return the correct balances", async function () {
            await credit(alice, 1);
            expect(await tokenContract.balanceOf(alice.address)).to.equal(1);

            await credit(alice, 2);
            expect(await tokenContract.balanceOf(alice.address)).to.equal(3);

            await credit(bob, 3);
            expect(await tokenContract.balanceOf(alice.address)).to.equal(3);
          });
        });
        describe("Allowance()", function () {
          it("should have correct initial allowance", async function () {
            expect(
              await tokenContract.allowance(deployer.address, alice.address)
            ).to.equal(0);
            expect(
              await tokenContract.allowance(deployer.address, bob.address)
            ).to.equal(0);
            expect(
              await tokenContract.allowance(bob.address, deployer.address)
            ).to.equal(0);
            expect(
              await tokenContract.allowance(alice.address, bob.address)
            ).to.equal(0);
          });
          it("should return the correct allowance", async function () {
            await tokenContract.approve(bob.address, 1);
            await tokenContract.approve(alice.address, 2);
            await tokenContractAlice.approve(deployer.address, 3);
            await tokenContractAlice.approve(charles.address, 4);
            await tokenContractBob.approve(alice.address, 5);
            await tokenContractBob.approve(alice.address, 6);

            expect(
              await tokenContract.allowance(deployer.address, bob.address)
            ).to.equal(1);
            expect(
              await tokenContractBob.allowance(deployer.address, alice.address)
            ).to.equal(2);
            expect(
              await tokenContract.allowance(alice.address, deployer.address)
            ).to.equal(3);
            expect(
              await tokenContract.allowance(alice.address, charles.address)
            ).to.equal(4);
            expect(
              await tokenContract.allowance(bob.address, alice.address)
            ).to.equal(6);
          });
          it("should return true when approving 0", async function () {
            expect(tokenContract.approve(bob.address, 0)).not.to.be.reverted;
          });
          it("should return true when approving", async function () {
            expect(tokenContract.approve(bob.address, 1)).not.to.be.reverted;
          });
          it("should return true when updating approval", async function () {
            expect(
              tokenContractBob.approve(alice.address, 2)
            ).to.be.revertedWith("Ownable: caller is not the owner");
            await tokenContractBob.approve(alice.address, 2);
            //decrease
            expect(tokenContractBob.approve(alice.address, 1)).not.to.be
              .reverted;
            //not-update
            expect(tokenContractBob.approve(alice.address, 2)).not.to.be
              .reverted;
            //increase
            expect(tokenContractBob.approve(alice.address, 3)).not.to.be
              .reverted;
          });
          it("should return true when revoking approval", async function () {
            await tokenContractAlice.approve(charles.address, 2);
            expect(tokenContractAlice.approve(charles.address, 0)).not.to.be
              .reverted;
          });
          it("should update allowance accordingly", async function () {
            await tokenContractAlice.approve(charles.address, 1);
            expect(
              await tokenContract.allowance(alice.address, charles.address)
            ).to.equal(1);
            await tokenContractAlice.approve(charles.address, 3);
            expect(
              await tokenContract.allowance(alice.address, charles.address)
            ).to.equal(3);
            await tokenContractAlice.approve(charles.address, 0);
            expect(
              await tokenContract.allowance(alice.address, charles.address)
            ).to.equal(0);
          });
        });
        describe("Transfer()", function () {
          it("should return true when called with amount of 0", async function () {
            expect(tokenContract.transfer(alice.address, 1)).not.to.be.reverted;
          });
          it("should return true when transfer can be made, false otherwise", async function () {
            credit(alice, 6);
            expect(tokenContractAlice.transfer(alice.address, 1)).not.to.be
              .reverted;
            expect(tokenContractAlice.transfer(bob.address, 2)).not.to.be
              .reverted;
            expect(tokenContractAlice.transfer(charles.address, 3)).not.to.be
              .reverted;
          });
          it("should revert when trying to transfer something while having nothing", async function () {
            await expect(tokenContractAlice.transfer(bob.address, 10)).to.be
              .reverted;
          });
          it("should revert when trying to transfer more than balance", async function () {
            await credit(bob, 9);
            await expect(tokenContractBob.transfer(charles.address, 10)).to.be
              .reverted;
          });
          it("should not affect total supply", async function () {
            await credit(bob, 10);
            let supply1 = await tokenContract.totalSupply();
            await tokenContractBob.transfer(charles.address, 10);
            let supply2 = await tokenContract.totalSupply();
            expect(supply2).to.be.equal(supply1);
          });
          it("should update balances accordingly", async function () {
            await credit(charles, 10);
            let fromBalance1 = await tokenContract.balanceOf(charles.address);
            let toBalance1 = await tokenContract.balanceOf(alice.address);
            await tokenContractCharles.transfer(alice.address, 10);
            let fromBalance2 = await tokenContract.balanceOf(charles.address);
            let toBalance2 = await tokenContract.balanceOf(alice.address);

            expect(fromBalance1).to.be.equal(fromBalance2.add(10));
            expect(toBalance1).to.be.equal(toBalance2.sub(10));
          });
        });
        describe("TransferFrom()", function () {
          beforeEach(async function () {
            await tokenContract.approve(charles.address, 5);
            await credit(alice, 6);
            await tokenContractAlice.approve(bob.address, 7);
          });
          it("should return Error with amount of 0 and sender is approved", async function () {
            await expect(
              tokenContractCharles.transferFrom(
                deployer.address,
                alice.address,
                0
              )
            ).to.be.revertedWith("Transfer amount must be greater than zero");
          });
          it("should return true when called with amount of 0 and sender is not approved", async function () {
            await expect(
              tokenContractCharles.transferFrom(
                alice.address,
                charles.address,
                0
              )
            ).to.be.revertedWith("Transfer amount must be greater than zero");
          });
          it("should return true when transfer can be made, false otherwise", async function () {
            await expect(
              tokenContractBob.transferFrom(alice.address, bob.address, 1)
            ).not.to.be.reverted;
            await expect(
              tokenContractBob.transferFrom(alice.address, deployer.address, 4)
            ).not.to.be.reverted;
            await expect(
              tokenContractCharles.transferFrom(
                deployer.address,
                charles.address,
                3
              )
            ).not.to.be.reverted;
          });
          it("should revert when trying to transfer something while having nothing", async function () {
            await tokenContractBob.approve(alice.address, 15);
            await expect(
              tokenContractAlice.transferFrom(bob.address, alice.address, 10)
            ).to.be.reverted;
          });
          it("should revert when trying to transfer more than balance", async function () {
            await expect(
              tokenContractBob.transferFrom(alice.address, charles.address, 7)
            ).to.be.reverted;
          });
          it("should revert when trying to transfer more than allowed", async function () {
            await expect(
              tokenContractCharles.transferFrom(
                deployer.address,
                charles.address,
                6
              )
            ).to.be.revertedWith("ERC20: insufficient allowance");
          });
          it("should not affect total supply", async function () {
            let supply1 = await tokenContract.totalSupply();
            await tokenContractBob.transferFrom(alice.address, bob.address, 4);
            let supply2 = await tokenContract.totalSupply();
            expect(supply2).to.be.equal(supply1);
          });
          it("should update balances accordingly", async function () {
            let fromBalance1 = await tokenContract.balanceOf(alice.address);
            let toBalance1 = await tokenContract.balanceOf(bob.address);
            await tokenContractBob.transferFrom(alice.address, bob.address, 5);
            let fromBalance2 = await tokenContract.balanceOf(alice.address);
            let toBalance2 = await tokenContract.balanceOf(bob.address);

            expect(fromBalance2).to.be.equal(fromBalance1.sub(5));
            expect(toBalance2).to.be.equal(toBalance1.add(5));
          });
          it("should update allowances accordingly", async function () {
            let fromAllowance1 = await tokenContract.allowance(
              deployer.address,
              charles.address
            );
            await tokenContractCharles.transferFrom(
              deployer.address,
              charles.address,
              5
            );
            let fromAllowance2 = await tokenContract.allowance(
              deployer.address,
              charles.address
            );
            expect(fromAllowance1).to.be.equal(fromAllowance2.add(5));
          });
        });
        describe("Increase(),Decrease(),Allowance()", function () {
          describe("Increase()", function () {
            it("should return true when increasing allowance", async function () {
              await expect(
                tokenContractCharles.increaseAllowance(alice.address, 0)
              ).not.to.be.reverted;
              await expect(
                tokenContractCharles.increaseAllowance(alice.address, 3)
              ).not.to.be.reverted;
              await tokenContractCharles.increaseAllowance(bob.address, 4);
              await expect(
                tokenContractCharles.increaseAllowance(alice.address, 3)
              ).not.to.be.reverted;
            });
            it("should update allowance accordingly", async function () {
              await tokenContractCharles.increaseAllowance(alice.address, 4);
              expect(
                await tokenContractCharles.allowance(
                  charles.address,
                  alice.address
                )
              ).to.be.equal(4);
              await tokenContractCharles.increaseAllowance(alice.address, 7);
              expect(
                await tokenContractCharles.allowance(
                  charles.address,
                  alice.address
                )
              ).to.be.equal(11);
              await tokenContractCharles.increaseAllowance(alice.address, 0);
              expect(
                await tokenContractCharles.allowance(
                  charles.address,
                  alice.address
                )
              ).to.be.equal(11);
            });
          });
          describe("Decrease()", function () {
            it("should return true decrease approval", async function () {
              await expect(
                tokenContractCharles.decreaseAllowance(alice.address, 0)
              ).not.to.be.reverted;
              await expect(
                tokenContractCharles.decreaseAllowance(alice.address, 3)
              ).to.be.revertedWith("ERC20: decreased allowance below zero");
              await tokenContractCharles.increaseAllowance(alice.address, 3);
              await expect(
                tokenContractCharles.decreaseAllowance(alice.address, 3)
              ).not.to.be.reverted;
            });
            it("should update allowance accordingly", async function () {
              await tokenContractCharles.increaseAllowance(alice.address, 4);
              await tokenContractCharles.decreaseAllowance(alice.address, 2);
              expect(
                await tokenContractCharles.allowance(
                  charles.address,
                  alice.address
                )
              ).to.be.equal(2);
              await tokenContractCharles.decreaseAllowance(alice.address, 1);
              expect(
                await tokenContractCharles.allowance(
                  charles.address,
                  alice.address
                )
              ).to.be.equal(1);
              await tokenContractCharles.decreaseAllowance(alice.address, 0);
              expect(
                await tokenContractCharles.allowance(
                  charles.address,
                  alice.address
                )
              ).to.be.equal(1);
            });
          });
        });
      });
      describe("Token specific functionality", function () {
        beforeEach(async () => {
          transactionFee = 5; // 5%
          overallFee = 13;
          feeReceiver = "0xe325854cfCC89546d9c9bfCFa32967864287bD0C";
          await credit(alice, 1000);
          await credit(bob, 1000);
        });
        describe("Transaction Fee", function () {
          it("Fee receiving address should get the right amount", async function () {
            let transferAmount = 100;
            let toBalance1 = await tokenContract.balanceOf(feeReceiver);
            await tokenContractBob.transfer(charles.address, transferAmount);
            let toBalance2 = await tokenContract.balanceOf(feeReceiver);
            expect(toBalance2).to.be.equal(
              toBalance1.add(transferAmount).mul(transactionFee).div(100)
            );
          });
          it("Fee receiving address should get the right amount when transferred from owner (0)", async function () {
            let transferAmount = 100;
            let toBalance1 = await tokenContract.balanceOf(feeReceiver);
            await tokenContract.transfer(charles.address, transferAmount);
            let toBalance2 = await tokenContract.balanceOf(feeReceiver);
            expect(toBalance2).to.be.equal(toBalance1);
          });
          it("Fee receiving address should get the right amount when transferred to owner (0)", async function () {
            let transferAmount = 100;
            let toBalance1 = await tokenContract.balanceOf(feeReceiver);
            await tokenContractBob.transfer(deployer.address, transferAmount);
            let toBalance2 = await tokenContract.balanceOf(feeReceiver);
            expect(toBalance2).to.be.equal(toBalance1);
          });
          it("Receiving address should get the right amount", async function () {
            let transferAmount = 100;
            let toBalance1 = await tokenContract.balanceOf(charles.address);
            await tokenContractBob.transfer(charles.address, transferAmount);
            let toBalance2 = await tokenContract.balanceOf(charles.address);
            expect(toBalance2).to.be.equal(
              transferAmount -
                toBalance1.add(transferAmount).mul(overallFee).div(100)
            );
          });
          it("Receiving address is able to spend the tokens", async function () {
            let transferAmount = 100;
            await tokenContractBob.transfer(charles.address, transferAmount);
            expect(
              tokenContractCharles.transfer(
                alice.address,
                transferAmount - transferAmount * overallFee
              )
            ).not.to.be.reverted;
          });
        });
        describe("Exclude/Include Fee", function () {
          beforeEach(async function () {
            // by default approve sender (via) to transfer
            await tokenContract.excludeFromFee(bob.address);
          });
          it("Fee receiving address should get the right amount when from-address is excluded from fees", async function () {
            let transferAmount = 100;
            let toBalance1 = await tokenContract.balanceOf(feeReceiver);
            await tokenContractBob.transfer(charles.address, transferAmount);
            let toBalance2 = await tokenContract.balanceOf(feeReceiver);
            expect(toBalance2).to.be.equal(toBalance1);
          });
          it("Fee receiving address should get the right amount when to-address is excluded from fees", async function () {
            let transferAmount = 100;
            let toBalance1 = await tokenContract.balanceOf(feeReceiver);
            await tokenContractAlice.transfer(bob.address, transferAmount);
            let toBalance2 = await tokenContract.balanceOf(feeReceiver);
            expect(toBalance2).to.be.equal(toBalance1);
          });
          it("Fee receiving address should get the right amount when to-address & from-address is excluded from fees", async function () {
            let transferAmount = 100;
            await tokenContract.excludeFromFee(alice.address);
            let toBalance1 = await tokenContract.balanceOf(feeReceiver);
            await tokenContractAlice.transfer(bob.address, transferAmount);
            let toBalance2 = await tokenContract.balanceOf(feeReceiver);
            expect(toBalance2).to.be.equal(toBalance1);
          });
          it("Owner can exclude address from fees", async function () {
            await expect(tokenContract.excludeFromFee(alice.address)).not.to.be
              .reverted;
          });
          it("Normal address can't exclude other address from fees", async function () {
            await expect(
              tokenContractBob.excludeFromFee(alice.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
          });
          it("Owner can include address in fees", async function () {
            await tokenContract.excludeFromFee(alice.address);
            await expect(tokenContract.includeInFee(alice.address)).not.to.be
              .reverted;
          });
          it("Normal address can't include address in fees", async function () {
            await tokenContract.excludeFromFee(alice.address);
            await expect(
              tokenContractBob.includeInFee(alice.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
          });
          it("Fee receiving address should get the right amount if address is included again", async function () {
            await tokenContract.includeInFee(bob.address);
            let transferAmount = 100;
            let toBalance1 = await tokenContract.balanceOf(feeReceiver);
            await tokenContractBob.transfer(bob.address, transferAmount);
            let toBalance2 = await tokenContract.balanceOf(feeReceiver);
            expect(toBalance2).to.be.equal(
              toBalance1.add(transferAmount).mul(transactionFee).div(100)
            );
          });
        });
        describe("Redistribution", function () {
          beforeEach(async function () {
            // Distribute the tokens between the different contract addresses
            /**
             * Deployer: 50% - 100M
             * Alice: 25% - 50M
             * Bob: 15% - 30M
             * Charles 10% - 20M
             */
            //ResetSupply
            await tokenContractAlice.transfer(deployer.address, 1000);
            await tokenContractBob.transfer(deployer.address, 1000);
            await tokenContract.transfer(
              alice.address,
              ethers.utils.parseUnits("50000000", 18)
            );
            await tokenContract.transfer(
              bob.address,
              ethers.utils.parseUnits("30000000", 18)
            );
            await tokenContract.transfer(
              charles.address,
              ethers.utils.parseUnits("20000000", 18)
            );
          });
          it("Addresses have the right balances", async function () {
            deployerBalance = await tokenContract.balanceOf(deployer.address);
            aliceBalance = await tokenContract.balanceOf(alice.address);
            bobBalance = await tokenContract.balanceOf(bob.address);
            charlesBalance = await tokenContract.balanceOf(charles.address);
            expect(deployerBalance).to.equal(
              ethers.utils.parseUnits("100000000", 18)
            );
            expect(aliceBalance).to.equal(
              ethers.utils.parseUnits("50000000", 18)
            );
            expect(bobBalance).to.equal(
              ethers.utils.parseUnits("30000000", 18)
            );
            expect(charlesBalance).to.equal(
              ethers.utils.parseUnits("20000000", 18)
            );
          });
          it("Right amount of liquidity fee collected", async function () {
            await tokenContractAlice.transfer(
              charles.address,
              ethers.utils.parseUnits("10000000", 18)
            );
            totalFees = await tokenContractAlice.totalFees();
            expect(totalFees).to.equal(ethers.utils.parseUnits("800000", 18));
          });
          it("Right amount of liquidity fee is distributed", async function () {
            await tokenContractAlice.transfer(
              charles.address,
              ethers.utils.parseUnits("10000000", 18)
            );
            deployerBalance = await tokenContract.balanceOf(deployer.address);
            aliceBalance = await tokenContract.balanceOf(alice.address);
            bobBalance = await tokenContract.balanceOf(bob.address);
            charlesBalance = await tokenContract.balanceOf(charles.address);

            expect(deployerBalance).to.equal("100401606425702811244979919");
            expect(aliceBalance).to.equal("40160642570281124497991967");
            expect(bobBalance).to.equal("30120481927710843373493975");
            expect(charlesBalance).to.equal("28815261044176706827309236");
          });
          it("total supply = initial supply", async function () {
            await tokenContractAlice.transfer(
              charles.address,
              ethers.utils.parseUnits("10000000", 18)
            );
            expect(await tokenContract.totalSupply()).to.equal(initialSupply);
          });
          it("sum addresses = total supply", async function () {
            await tokenContractAlice.transfer(
              charles.address,
              ethers.utils.parseUnits("10000000", 18)
            );
            deployerBalance = await tokenContract.balanceOf(deployer.address);
            aliceBalance = await tokenContract.balanceOf(alice.address);
            bobBalance = await tokenContract.balanceOf(bob.address);
            charlesBalance = await tokenContract.balanceOf(charles.address);
            feeBalance = await tokenContract.balanceOf(feeReceiver);

            expect(
              deployerBalance
                .add(aliceBalance)
                .add(bobBalance)
                .add(charlesBalance)
                .add(feeBalance)
            ).to.be.at.most(initialSupply);
          });
        });
      });
    });
module.exports.tags = ["all", "token"];
