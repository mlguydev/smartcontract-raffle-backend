const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const VRF_SUBSCRIPTION_AMOUNT = ethers.utils.parseEther("2");
module.exports = async function({ getNamedAccounts, deployments }) {
	const { deploy, log } = deployments;
	const {deployer } = await getNamedAccounts();
	const chainId = network.config.chainId
	let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock
	
	if (developmentChains.includes(network.name)) {
		vrfCoordinatorV2Mock = 
		await ethers.getContract("VRFCoordinatorV2Mock");
		vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
		const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
		const transactionReceipt = await transactionResponse.wait(1);
		subscriptionId = transactionReceipt.events[0].args.subId;
		await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUBSCRIPTION_AMOUNT);
	} else {
		vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
		subscriptionId = networkConfig[chainId]["subscriptionId"];
	}

	const entranceFee = networkConfig[chainId]["entranceFee"];
	const gasLane = networkConfig[chainId]["gasLane"];
	const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
	const interval = networkConfig[chainId]["interval"];
	const args = [vrfCoordinatorV2Address, subscriptionId, gasLane, interval, entranceFee, callbackGasLimit];

	const raffle = await deploy("Raffle", {
		from: deployer,
		args: args,
		log: true,
		waitConfirmations: network.config.blockConfirmations || 1,
	});

	if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {7
		log("Verifying...");
		await verify(raffle.address, args);
	} else {
		await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), raffle.address);
	}

	console.log("Raffle deployed and verified.")
	log("------------------------------")

}

module.exports.tags = ["all", "raffle"];