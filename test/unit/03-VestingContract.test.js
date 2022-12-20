const { expect } = require("chai");
const { network, deployments, ethers, time } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

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
        tokenContractUSD = await ethers.getContract("BEP20USDT");
        tokenContractVesting = await ethers.getContract("EncdVesting");
        tokenContractICO = await ethers.getContract("ENCD_ICO");

        tokenContract = tokenContract.connect(deployer);

        tokenContractICO = tokenContractICO.connect(deployer);
        tokenContractICOAlice = tokenContractICO.connect(alice);
        tokenContractICOBob = tokenContractICO.connect(bob);
        tokenContractICOCharles = tokenContractICO.connect(charles);

        tokenContractUSDT = tokenContractUSD.connect(deployer);
        tokenContractUSDTAlice = tokenContractUSD.connect(alice);
        tokenContractUSDTBob = tokenContractUSD.connect(bob);
        tokenContractUSDTCharles = tokenContractUSD.connect(charles);

        tokenContractVesting = tokenContractVesting.connect(deployer);
        tokenContractVestingAlice = tokenContractVesting.connect(alice);
        tokenContractVestingBob = tokenContractVesting.connect(bob);
        tokenContractVestingCharles = tokenContractVesting.connect(charles);
        await tokenContract.excludeFromFee(tokenContractVesting.address);
        await tokenContract.excludeFromReward(tokenContractVesting.address);
      });
      describe("Vesting standalone", function () {
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
          await tokenContract.transfer(
            tokenContractVesting.address,
            ethers.utils.parseUnits("200000000", 18)
          );
        });
        describe("Initalization()", function () {
          it("contract has the correct token balance", async function () {
            expect(
              await tokenContract.balanceOf(tokenContractVesting.address)
            ).to.equal(ethers.utils.parseUnits("200000000", 18));
          });
        });
        describe("createVestingSchedule()", function () {
          it("non-owner can't create vesting schedule", async function () {
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;
            const cliff = 60 * 60 * 24 * 30 * 6;
            const duration = 60 * 60 * 24 * 30 * 2;
            const slicePeriodSeconds = 60 * 60 * 24;
            const amounttge = 5;
            const amount = 100;
            await expect(
              tokenContractVestingAlice.createVestingSchedule(
                alice.address,
                timestampBefore,
                cliff,
                duration,
                slicePeriodSeconds,
                amounttge,
                amount
              )
            ).to.revertedWith("Ownable: caller is not the owner");
          });
          it("owner can create vesting schedule", async function () {
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;
            const cliff = 60 * 60 * 24 * 30 * 6;
            const duration = 60 * 60 * 24 * 30 * 2;
            const slicePeriodSeconds = 60 * 60 * 24;
            const amounttge = 5;
            const amount = 100;
            await expect(
              tokenContractVesting.createVestingSchedule(
                alice.address,
                timestampBefore,
                cliff,
                duration,
                slicePeriodSeconds,
                amounttge,
                amount
              )
            ).to.not.be.reverted;
          });
          describe("VestingSchedule already created", function () {
            beforeEach(async () => {
              const blockNumBefore = await ethers.provider.getBlockNumber();
              const blockBefore = await ethers.provider.getBlock(
                blockNumBefore
              );
              const timestampBefore = blockBefore.timestamp;
              const cliff = 60 * 60 * 24 * 30 * 6;
              const duration = 60 * 60 * 24 * 30 * 2 + 60 * 60 * 24 * 30 * 6;
              const slicePeriodSeconds = 60 * 60 * 24;
              const amounttge = 10;
              const amount = 100;
              await tokenContractVesting.createVestingSchedule(
                alice.address,
                timestampBefore + 10,
                cliff,
                duration,
                slicePeriodSeconds,
                amounttge,
                amount
              );
              await tokenContract.excludeFromFee(tokenContractVesting.address);
            });
            it("VestingSchedule initalization", async function () {
              expect(
                await tokenContractVesting.getVestingSchedulesCount()
              ).to.be.equal(1);
              expect(
                await tokenContractVesting.getVestingSchedulesCountByBuyer(
                  alice.address
                )
              ).to.be.equal(1);
            });
            it("computeReleasableAmount()", async function () {
              const vestingScheduleId =
                await tokenContractVesting.computeVestingScheduleIdForAddressAndIndex(
                  alice.address,
                  0
                );
              expect(
                await tokenContractVesting.computeReleasableAmount(
                  vestingScheduleId
                )
              ).to.be.equal(0);
            });
            it("computeReleasableAmount() after certain time", async function () {
              await helpers.time.increase(15552000);
              await helpers.time.increase(86400);
              const vestingScheduleId =
                await tokenContractVesting.computeVestingScheduleIdForAddressAndIndex(
                  alice.address,
                  0
                );
              expect(
                await tokenContractVesting.computeReleasableAmount(
                  vestingScheduleId
                )
              ).to.be.equal(77);
            });
            it("computeReleasableAmount() after end time", async function () {
              await helpers.time.increase(15552000000);
              await helpers.time.increase(86400);
              const vestingScheduleId =
                await tokenContractVesting.computeVestingScheduleIdForAddressAndIndex(
                  alice.address,
                  0
                );
              expect(
                await tokenContractVesting.computeReleasableAmount(
                  vestingScheduleId
                )
              ).to.be.equal(100);
            });
            it("beneficiary can release partial amount", async function () {
              await helpers.time.increase(15552000);
              await helpers.time.increase(86400);
              const vestingScheduleId =
                await tokenContractVesting.computeVestingScheduleIdForAddressAndIndex(
                  alice.address,
                  0
                );
              await expect(
                tokenContractVestingAlice.release(vestingScheduleId, 75)
              ).to.not.be.reverted;
            });
            it("beneficiary receives the right amount", async function () {
              await helpers.time.increase(15552000);
              await helpers.time.increase(86400);
              const vestingScheduleId =
                await tokenContractVesting.computeVestingScheduleIdForAddressAndIndex(
                  alice.address,
                  0
                );

              ENCDBalance = await tokenContract.balanceOf(alice.address);
              await tokenContractVestingAlice.release(vestingScheduleId, 75);
              ENCDBalance1 = await tokenContract.balanceOf(alice.address);
              expect(ENCDBalance1).to.be.equal(ENCDBalance.add(75));
            });
            it("vesting works", async function () {
              const blockNumBefore = await ethers.provider.getBlockNumber();
              const blockBefore = await ethers.provider.getBlock(
                blockNumBefore
              );
              const timestampBefore = blockBefore.timestamp;
              const cliff = 10;
              const duration = 50;
              const slicePeriodSeconds = 1;
              const amounttge = 0;
              const amount = 100;
              await tokenContractVesting.createVestingSchedule(
                bob.address,
                timestampBefore,
                timestampBefore + cliff,
                duration,
                slicePeriodSeconds,
                amounttge,
                amount
              );

              const vestingScheduleId1 =
                await tokenContractVesting.computeVestingScheduleIdForAddressAndIndex(
                  bob.address,
                  0
                );
              await helpers.time.increase(1);
              expect(
                await tokenContractVesting.computeReleasableAmount(
                  vestingScheduleId1
                )
              ).to.be.equal(0);
            });
          });
        });

        describe("TestVestingSchedule()", function () {
          it("correct amount is released", async function () {
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;
            const cliff = 120;
            const duration = 1000;
            const slicePeriodSeconds = 5;
            const amounttge = 100;
            const amount = 1000;
            await tokenContractVesting.createVestingSchedule(
              charles.address,
              timestampBefore + 50,
              cliff,
              duration,
              slicePeriodSeconds,
              amounttge,
              amount
            );
            const vestingScheduleCH =
              await tokenContractVesting.computeVestingScheduleIdForAddressAndIndex(
                charles.address,
                0
              );
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(0);
            await helpers.time.increase(45);
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(0);
            await helpers.time.increase(5);
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(100);
            await helpers.time.increase(100);
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(100);
            await helpers.time.increase(20); //End of cliff
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(208);
            await helpers.time.increase(3); //5sed interval amount should stay the same
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(208);
            await helpers.time.increase(3); //Amount should change
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(212);
            await helpers.time.increase(6); //Amount should change
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(217);
            await helpers.time.increase(750); //Amount should change
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(892);
            await helpers.time.increase(10); //Amount should change
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(901);
            await helpers.time.increase(110); //Amount should change
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(1000);
          });
          it("correct amount is released when released", async function () {
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;
            const cliff = 120;
            const duration = 1000;
            const slicePeriodSeconds = 5;
            const amounttge = 100;
            const amount = 1000;
            await tokenContractVesting.createVestingSchedule(
              charles.address,
              timestampBefore + 50,
              cliff,
              duration,
              slicePeriodSeconds,
              amounttge,
              amount
            );
            const vestingScheduleCH =
              await tokenContractVesting.computeVestingScheduleIdForAddressAndIndex(
                charles.address,
                0
              );
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(0);
            await helpers.time.increase(45);
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(0);
            await helpers.time.increase(5);
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(100);
            await helpers.time.increase(100);
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(100);
            await tokenContract.excludeFromFee(tokenContractVesting.address);

            ENCDBalanceB = await tokenContract.balanceOf(charles.address);
            await tokenContractVestingCharles.release(vestingScheduleCH, 100);
            ENCDBalanceB1 = await tokenContract.balanceOf(charles.address);
            expect(ENCDBalanceB1).to.be.equal(ENCDBalanceB.add(100));

            await helpers.time.increase(20); //End of cliff
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(108);
            await helpers.time.increase(1); //5sed interval amount should stay the same
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(108);
            await helpers.time.increase(3); //Amount should change
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(112);
            await helpers.time.increase(6); //Amount should change
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(117);
            await helpers.time.increase(750); //Amount should change
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(792);
            ENCDBalanceB2 = await tokenContract.balanceOf(charles.address);
            await tokenContractVestingCharles.release(vestingScheduleCH, 792);
            ENCDBalanceB3 = await tokenContract.balanceOf(charles.address);
            expect(ENCDBalanceB3).to.be.equal(ENCDBalanceB2.add(792));

            await helpers.time.increase(10); //Amount should change
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(9);
            await helpers.time.increase(110); //Amount should change
            expect(
              await tokenContractVesting.computeReleasableAmount(
                vestingScheduleCH
              )
            ).to.be.equal(108);
          });
        });
      });
    });
module.exports.tags = ["all", "vesting"];
