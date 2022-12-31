require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PK2 = process.env.PK2;
const PK3 = process.env.PK3;
const PK4 = process.env.PK4;

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL;
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.7",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      blockCofirmations: 1,
    },
    goerli: {
      chainId: 5,
      blockCofirmations: 6,
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY, PK2, PK3, PK4]
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: true,
    currency: "GBP",
    outputFile: "gas-report.txt",
    noColors: true,
    coinmarketcap: COINMARKETCAP_API_KEY,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    p2: {
      default: 1
    },
    p3: {
      default: 2
    },
    p4: {
      default: 3
    }
  },
  mocha: {
    timeout: 0,
  }
};

