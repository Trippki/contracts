pragma solidity ^0.4.17;

import './TRIPToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

/**
 * @title Team and Advisors Token Allocation contract
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract TeamAndAdvisorsAllocation {
    using SafeMath for uint;
    address public owner;
    uint256 public unlockedAt;
    uint256 public canSelfDestruct;
    uint256 public tokensCreated;
    uint256 public allocatedTokens;
    uint256 private totalTeamAndAdvisorsAllocation = 14800000e18;

    mapping (address => uint256) public teamAndAdvisorsAllocations;

    TRIPToken public trip;

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev constructor function that sets owner and token for the TeamAndAdvisorsAllocation contract
     * @param _owner Contract owner
     * @param token Token contract address for TRIPToken
     */
    function TeamAndAdvisorsAllocation(address _owner, address token) public {
        trip = TRIPToken(token);
        unlockedAt = now.add(182 days);
        canSelfDestruct = now.add(365 days);
        owner = _owner;
    }

    /**
     * @dev Adds founders' token allocation
     * @param teamOrAdvisorsAddress Address of a founder
     * @param allocationValue Number of tokens allocated to a founder
     * @return true if address is correctly added
     */
    function addTeamAndAdvisorsAllocation(address teamOrAdvisorsAddress, uint256 allocationValue)
        external
        onlyOwner
        returns(bool)
    {
        assert(teamAndAdvisorsAllocations[teamOrAdvisorsAddress] == 0); // can only add once.

        allocatedTokens = allocatedTokens.add(allocationValue);
        require(allocatedTokens <= totalTeamAndAdvisorsAllocation);

        teamAndAdvisorsAllocations[teamOrAdvisorsAddress] = allocationValue;
        return true;
    }

    /**
     * @dev Allow company to unlock allocated tokens by transferring them whitelisted addresses.
     * Need to be called by each address
     */
    function unlock() external {
        assert(now >= unlockedAt);

        // During first unlock attempt fetch total number of locked tokens.
        if (tokensCreated == 0) {
            tokensCreated = trip.balanceOf(this);
        }

        uint256 transferAllocation = teamAndAdvisorsAllocations[msg.sender];
        teamAndAdvisorsAllocations[msg.sender] = 0;

        // Will fail if allocation (and therefore toTransfer) is 0.
        require(trip.transfer(msg.sender, transferAllocation));
    }

    /**
     * @dev allow for selfdestruct possibility and sending funds to owner
     */
    function kill() public onlyOwner {
        assert(now >= canSelfDestruct);
        uint256 balance = trip.balanceOf(this);

        if (balance > 0) {
            trip.transfer(owner, balance);
        }

        selfdestruct(owner);
    }
}
