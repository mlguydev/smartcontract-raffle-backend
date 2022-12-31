const { assert, expect } = require("chai");
const { network, getNamedAccounts, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

const ENABLED = true;

developmentChains.includes(network.name) || !ENABLED
? describe.skip
: describe("Raffle Multiplayer Unit Tests", function () {

	let raffle, raffleEntranceFee, deployer

	beforeEach(async function () {

		deployer = (await getNamedAccounts()).deployer;
		raffle = await ethers.getContract("Raffle");
		raffleEntranceFee = await raffle.getEntranceFee();
		interval = await raffle.getInterval();

		const rb = await ethers.provider.getBalance(raffle.address);
		console.log("Raffle Balance :");
		console.log(rb.toString());

	});

	describe("Full Test", function () {

		it("Allows multiple entries, picks a winner, pays them, resets the raffle", async function () {

			await new Promise(async (resolve, reject) => {

				raffle.on("RaffleEnter", () => {
					console.log("RaffleEnter event detected...");
				});

				raffle.on("RequestedRaffleWinner", () => {
					console.log("RequestedRaffleWinner event detected...");
				});

				raffle.on("WinnerPicked", async () => {

					try {

						const recentWinner = await raffle.getRecentWinner();
						console.log(`Raffle winner was : ${recentWinner}`);
						const winnerBalance = await ethers.provider.getBalance(recentWinner);
						console.log(`Winners new balance : ${winnerBalance.toString()}`);
						const raffleBalance = await ethers.provider.getBalance(raffle.address);
						console.log(`Raffle balance : ${raffleBalance.toString()}`);
						assert.equal(raffleBalance.toString(), "0");

						resolve();

					} catch (e) {
						console.log(e);
						reject(e);
					}

				});

				const accounts = await ethers.getSigners();
				let tx;
				
				for (i = 0; i < accounts.length; i++) {
					console.log(`${accounts[i].address} entering raffle...`);
					const raffleConnected = await raffle.connect(accounts[i]);
					tx = await raffleConnected.enterRaffle({ value: raffleEntranceFee });
				}

				console.log("Waiting for block confirmations...")
				await tx.wait(1);
				const raffleBalance = await ethers.provider.getBalance(raffle.address);
				console.log(`Raffle balance : ${raffleBalance.toString()}`);
				
				console.log("Listening for events...")

			});

			console.log("Full test complete.")

		});

	});



});
