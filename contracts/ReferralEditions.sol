// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import {ERC721} from "./ERC721.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";




/**
 * @title Editions
 * @author MirrorXYZ
 */
contract ReferralEditions is ERC721, ReentrancyGuard {

    using Address for address payable;
    using SafeMath for uint256;


    // ============ Constants ============

    string public constant name = "Referral Editions";
    string public constant symbol = "REFERRAL";

    // ============ Structs ============

    struct Edition {
        // The maximum number of tokens that can be sold.
        uint256 quantity;
        // The price at which each token will be sold, in ETH.
        uint256 price;
        // The amount paid to the referrer (cannot be larger than price)
        uint256 commissionPrice;
        // The account that will receive sales revenue.
        address payable fundingRecipient;
        // The number of tokens sold so far.
        uint256 numSold;

        string tokenURI;
    }

    // ============ Immutable Storage ============

    // The URI for the API that serves the content for each token.
    // Note: Strings cannot be literally immutable.
    string internal baseURI;

    // ============ Mutable Storage ============

    // Mapping of edition id to descriptive data.
    mapping(uint256 => Edition) public editions;
    // Mapping of token id to edition id.
    mapping(uint256 => uint256) public tokenToEdition;
    // The amount of funds that have already been withdrawn for a given edition.
    mapping(uint256 => uint256) public withdrawnForEdition;
    // `nextTokenId` increments with each token purchased, globally across all editions.
    uint256 private nextTokenId;
    // Editions start at 1, in order that unsold tokens don't map to the first edition.
    uint256 private nextEditionId = 1;

    // fallback for send failure
    mapping(address => uint256) private pendingWithdrawals;


    // ============ Events ============

    event EditionCreated(
        uint256 quantity,
        uint256 price,
        uint256 commissionPrice,
        address fundingRecipient,
        uint256 indexed editionId
    );

    event EditionPurchased(
        uint256 indexed editionId,
        uint256 indexed tokenId,
        // `numSold` at time of purchase represents the "serial number" of the NFT.
        uint256 numSold,
        // The account that paid for and received the NFT.
        address indexed buyer,
        // The account that referred the buyer.
        address referrer
    );

    event WithdrawPending(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    // ============ Constructor ============

    constructor() {}

    // ============ Edition Methods ============

    function createEdition(
        // The number of tokens that can be minted and sold.
        uint256 quantity,
        // The price to purchase a token.
        uint256 price,
        // The amount paid to the referrer (cannot be larger than price)
        uint256 commissionPrice,
        // The account that should receive the revenue.
        address payable fundingRecipient,
        // tokenURI
        string memory _tokenURI
    ) external {
        require(price >= commissionPrice, "ReferralEditions: the price must be greater than or equal to commission price");
        editions[nextEditionId] = Edition({
            quantity: quantity,
            price: price,
            commissionPrice: commissionPrice,
            fundingRecipient: fundingRecipient,
            numSold: 0,
            tokenURI: _tokenURI
        });

        emit EditionCreated(quantity, price, commissionPrice, fundingRecipient, nextEditionId);
        nextEditionId++;
    }

    function buyEdition(uint256 editionId, address curator) external payable {
        // Check that the edition exists. Note: this is redundant
        // with the next check, but it is useful for clearer error messaging.
        require(editions[editionId].quantity > 0, "Edition does not exist");
        require(msg.sender != curator, "Cannot refer edition to yourself");

        // Check that there are still tokens available to purchase.
        require(
            editions[editionId].numSold < editions[editionId].quantity,
            "This edition is already sold out."
        );
        // Check that the sender is paying the correct amount.
        require(
            msg.value == editions[editionId].price,
            "Must send enough to purchase the edition."
        );

        if (curator != address(0)) {
            uint256 recipientAmount = editions[editionId].price.sub(editions[editionId].commissionPrice);
            _sendValueWithFallbackWithdrawWithLowGasLimit(
                editions[editionId].fundingRecipient,
                recipientAmount
            );

            _sendValueWithFallbackWithdrawWithMediumGasLimit(
                payable(curator),
                editions[editionId].commissionPrice
            );
        } else {
            _sendValueWithFallbackWithdrawWithLowGasLimit(
                editions[editionId].fundingRecipient,
                editions[editionId].price
            );
        }

        // Increment the number of tokens sold for this edition.
        editions[editionId].numSold++;
        // Mint a new token for the sender, using the `nextTokenId`.
        _mint(msg.sender, nextTokenId);
        // Store the mapping of token id to the edition being purchased.
        tokenToEdition[nextTokenId] = editionId;

        emit EditionPurchased(
            editionId,
            nextTokenId,
            editions[editionId].numSold,
            msg.sender,
            curator
        );

        nextTokenId++;
    }


    function getEditionURI(uint256 editionId) public view returns (string memory) {
        // Check that the edition exists. Note: this is redundant
        // with the next check, but it is useful for clearer error messaging.
        require(editions[editionId].quantity > 0, "Edition does not exist");
        return editions[editionId].tokenURI;
    }

    // ============ Operational Methods ============

    function withdraw() public {
        withdrawFor(msg.sender);
    }

    function withdrawFor(address user) public nonReentrant {
        uint256 amount = pendingWithdrawals[user];
        require(amount > 0, "No funds are pending withdrawal");
        pendingWithdrawals[user] = 0;
        payable(user).sendValue(amount);
        emit Withdrawal(user, amount);
    }

    // ============ NFT Methods ============

        // Returns e.g. https://mirror-api.com/editions/[editionId]/[tokenId]
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        // If the token does not map to an edition, it'll be 0.
        require(tokenToEdition[tokenId] > 0, "Token has not been sold yet");
        // Concatenate the components, baseURI, editionId and tokenId, to create URI.
        return editions[tokenToEdition[tokenId]].tokenURI;
    }


    // ============ Private Methods ============

        /**
     * @dev Attempt to send a user or contract ETH and if it fails store the amount owned for later withdrawal.
     */
    function _sendValueWithFallbackWithdraw(
        address payable user,
        uint256 amount,
        uint256 gasLimit
    ) private {
        if (amount == 0) {
            return;
        }
        // Cap the gas to prevent consuming all available gas to block a tx from completing successfully
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = user.call{value: amount, gas: gasLimit}("");
        if (!success) {
            // Record failed sends for a withdrawal later
            // Transfers could fail if sent to a multisig with non-trivial receiver logic
            // solhint-disable-next-line reentrancy
            pendingWithdrawals[user] = pendingWithdrawals[user].add(amount);
            emit WithdrawPending(user, amount);
        }
    }

    /**
     * @dev Attempt to send a user ETH with a reasonably low gas limit of 20k,
     * which is enough to send to contracts as well.
     */
    function _sendValueWithFallbackWithdrawWithLowGasLimit(
        address payable user,
        uint256 amount
    ) internal {
        _sendValueWithFallbackWithdraw(user, amount, 20000);
    }

    /**
     * @dev Attempt to send a user or contract ETH with a moderate gas limit of 90k,
     * which is enough for a 5-way split.
     */
    function _sendValueWithFallbackWithdrawWithMediumGasLimit(
        address payable user,
        uint256 amount
    ) internal {
        _sendValueWithFallbackWithdraw(user, amount, 210000);
    }


    // From https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Strings.sol
    function _toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT licence
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
