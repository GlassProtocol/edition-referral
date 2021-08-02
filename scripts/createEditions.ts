import { utils } from 'ethers';
import { ethers } from 'hardhat'

async function main() {
  const EditionsFactory = await ethers.getContractFactory("ReferralEditions");
    const editions = EditionsFactory.attach('0xBB2F053175aE908B77790A2037236A971EBC8ebB');
    console.log(editions.address)
    await editions.createEdition(
        // The number of tokens that can be minted and sold.
        10,
        // The price to purchase a token.
        utils.parseEther('0.15'),
        // The amount paid to the referrer (cannot be larger than price)
        utils.parseEther('0.15'),
        // The account that should receive the revenue.
        '0x1FD26c8990EBC58fE5968DBeF0df2D855B964A6a',
    )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });