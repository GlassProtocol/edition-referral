import * as dotenv from 'dotenv'
import { HardhatUserConfig } from 'hardhat/types'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-solhint'
import '@typechain/hardhat'

dotenv.config();


const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 2000
      }
    }
  },
  typechain: {
    outDir: 'ts-types/contracts',
    target: 'ethers-v5'
  },
  networks: {
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [process.env.TESTING_PRIVATE_KEY],
    },
  },
  // abiExporter: {
  //   path: 'abis',
  //   clear: true,
  //   flat: true,
  //   only: [':ReserveAuction$'],
  //   spacing: 2
  // }
};


export default config