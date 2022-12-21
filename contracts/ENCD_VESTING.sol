// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract EncdVesting is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        bool initialized;
        address buyer; // buyer of tokens after they are released
        uint256 cliff; // start period in seconds
        uint256 start; // start time of the vesting period
        uint256 duration; // duration of the vesting period in seconds
        uint256 slicePeriodSeconds; // duration of a slice period for the vesting in seconds
        uint256 amountTge; // amount of tokens to be released at tge
        uint256 amountTotal; // total amount of tokens to be released
        uint256 released; // amount of tokens released
    }

    //address of the token
    IERC20 private immutable _addressENCD;

    bytes32[] private vestingSchedulesIds;
    mapping(bytes32 => VestingSchedule) private vestingSchedules;
    uint256 private vestingSchedulesTotalAmount;
    mapping(address => uint256) private holdersVestingCount;

    event Released(uint256 amount);
    event Revoked();

    /**
     * @dev reverts if no vesting schedule matches the passed identifier.
     */
    modifier onlyIfVestingScheduleExists(bytes32 vestingScheduleId) {
        require(vestingSchedules[vestingScheduleId].initialized == true);
        _;
    }

    /**
     * @dev creates a vesting contract.
     * @param token_ address of the ERC20 token contract
     */
    constructor(address token_) {
        require(token_ != address(0x0));
        _addressENCD = IERC20(token_);
    }

    receive() external payable {}

    fallback() external payable {}

    /**
     * @dev returns the number of vesting schedules associated to a buyer.
     * @return the number of vesting schedules
     */
    function getVestingSchedulesCountByBuyer(
        address _buyer
    ) external view returns (uint256) {
        return holdersVestingCount[_buyer];
    }

    /**
     * @dev returns the vesting schedule id at the given index.
     * @return the vesting id
     */
    function getVestingIdAtIndex(
        uint256 index
    ) external view returns (bytes32) {
        require(
            index < getVestingSchedulesCount(),
            "TokenVesting: index out of bounds"
        );
        return vestingSchedulesIds[index];
    }

    /**
     * @notice returns the vesting schedule information for a given holder and index.
     * @return the vesting schedule structure information
     */
    function getVestingScheduleByAddressAndIndex(
        address holder,
        uint256 index
    ) external view returns (VestingSchedule memory) {
        return
            getVestingSchedule(
                computeVestingScheduleIdForAddressAndIndex(holder, index)
            );
    }

    /**
     * @notice returns the total amount of vesting schedules.
     * @return the total amount of vesting schedules
     */
    function getVestingSchedulesTotalAmount() external view returns (uint256) {
        return vestingSchedulesTotalAmount;
    }

    /**
     * @dev returns the address of the ERC20 token managed by the vesting contract.
     */
    function getToken() external view returns (address) {
        return address(_addressENCD);
    }

    /**
     * @notice creates a new vesting schedule for a buyer.
     * @param _buyer address of the buyer to whom vested tokens are transferred
     * @param _start start time of the vesting period
     * @param _cliff duration in seconds of the cliff in which tokens will begin to vest
     * @param _duration duration in seconds of the period in which the tokens will vest
     * @param _slicePeriodSeconds duration of a slice period for the vesting in seconds
     * @param _amountTge amount of tokens to be released at the start of the vesting
     * @param _amount total amount of tokens to be released at the end of the vesting
     */
    function createVestingSchedule(
        address _buyer,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration,
        uint256 _slicePeriodSeconds,
        uint256 _amountTge,
        uint256 _amount
    ) public onlyOwner {
        require(
            this.getWithdrawableAmount() >= _amount,
            "TokenVesting: cannot create vesting schedule because not sufficient tokens"
        );
        require(_duration > 0, "TokenVesting: duration must be > 0");
        require(_amount > 0, "TokenVesting: amount must be > 0");
        require(
            _slicePeriodSeconds >= 1,
            "TokenVesting: slicePeriodSeconds must be >= 1"
        );
        bytes32 vestingScheduleId = this.computeNextVestingScheduleIdForHolder(
            _buyer
        );
        uint256 cliff = _start.add(_cliff);
        vestingSchedules[vestingScheduleId] = VestingSchedule(
            true,
            _buyer,
            cliff,
            _start,
            _duration,
            _slicePeriodSeconds,
            _amountTge,
            _amount,
            0
        );
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount.add(_amount);
        vestingSchedulesIds.push(vestingScheduleId);
        uint256 currentVestingCount = holdersVestingCount[_buyer];
        holdersVestingCount[_buyer] = currentVestingCount.add(1);
    }

    /**
     * @notice release vested amount of tokens.
     * @param vestingScheduleId the vesting schedule identifier
     * @param amount the amount to release
     */
    function release(
        bytes32 vestingScheduleId,
        uint256 amount
    ) public nonReentrant {
        VestingSchedule storage vestingSchedule = vestingSchedules[
            vestingScheduleId
        ];
        bool isbuyer = msg.sender == vestingSchedule.buyer;
        bool isOwner = msg.sender == owner();
        require(
            isbuyer || isOwner,
            "TokenVesting: only buyer and owner can release vested tokens"
        );
        uint256 vestedAmount = _computeReleasableAmount(vestingSchedule);
        require(
            vestedAmount >= amount,
            "TokenVesting: cannot release tokens, not enough vested tokens"
        );
        vestingSchedule.released = vestingSchedule.released.add(amount);
        address payable buyerPayable = payable(vestingSchedule.buyer);
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount.sub(amount);
        _addressENCD.safeTransfer(buyerPayable, amount);
    }

    /**
     * @dev returns the number of vesting schedules managed by this contract.
     * @return the number of vesting schedules
     */
    function getVestingSchedulesCount() public view returns (uint256) {
        return vestingSchedulesIds.length;
    }

    /**
     * @notice computes the vested amount of tokens for the given vesting schedule identifier.
     * @return the vested amount
     */
    function computeReleasableAmount(
        bytes32 vestingScheduleId
    ) public view returns (uint256) {
        VestingSchedule storage vestingSchedule = vestingSchedules[
            vestingScheduleId
        ];
        return _computeReleasableAmount(vestingSchedule);
    }

    /**
     * @notice returns the vesting schedule information for a given identifier.
     * @return the vesting schedule structure information
     */
    function getVestingSchedule(
        bytes32 vestingScheduleId
    ) public view returns (VestingSchedule memory) {
        return vestingSchedules[vestingScheduleId];
    }

    /**
     * @dev returns the amount of tokens that can be withdrawn by the owner.
     * @return the amount of tokens
     */
    function getWithdrawableAmount() public view returns (uint256) {
        return
            _addressENCD.balanceOf(address(this)).sub(
                vestingSchedulesTotalAmount
            );
    }

    /**
     * @dev computes the next vesting schedule identifier for a given holder address.
     */
    function computeNextVestingScheduleIdForHolder(
        address holder
    ) public view returns (bytes32) {
        return
            computeVestingScheduleIdForAddressAndIndex(
                holder,
                holdersVestingCount[holder]
            );
    }

    /**
     * @dev returns the last vesting schedule for a given holder address.
     */
    function getLastVestingScheduleForHolder(
        address holder
    ) public view returns (VestingSchedule memory) {
        return
            vestingSchedules[
                computeVestingScheduleIdForAddressAndIndex(
                    holder,
                    holdersVestingCount[holder] - 1
                )
            ];
    }

    /**
     * @dev computes the vesting schedule identifier for an address and an index.
     */
    function computeVestingScheduleIdForAddressAndIndex(
        address holder,
        uint256 index
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    /**
     * @dev computes the releasable amount of tokens for a vesting schedule.
     * @return the amount of releasable tokens
     */
    function _computeReleasableAmount(
        VestingSchedule memory vestingSchedule
    ) internal view returns (uint256) {
        uint256 currentTime = getCurrentTime();
        if (
            (currentTime < vestingSchedule.cliff) &&
            (currentTime < vestingSchedule.start)
        ) {
            return 0;
        } else if (
            (currentTime < vestingSchedule.cliff) &&
            (currentTime >= vestingSchedule.start)
        ) {
            return vestingSchedule.amountTge.sub(vestingSchedule.released);
        } else if (
            currentTime >= vestingSchedule.start.add(vestingSchedule.duration)
        ) {
            return vestingSchedule.amountTotal.sub(vestingSchedule.released);
        } else {
            uint256 timeFromStart = currentTime.sub(vestingSchedule.start);
            uint secondsPerSlice = vestingSchedule.slicePeriodSeconds;
            uint256 vestedSlicePeriods = timeFromStart.div(secondsPerSlice);
            uint256 vestedSeconds = vestedSlicePeriods.mul(secondsPerSlice);
            uint256 vestedAmount = (vestingSchedule.amountTotal -
                vestingSchedule.amountTge).mul(vestedSeconds).div(
                    vestingSchedule.duration
                );
            return
                vestedAmount.add(vestingSchedule.amountTge).sub(
                    vestingSchedule.released
                );
        }
    }

    /**
     * @dev gets current time
     */
    function getCurrentTime() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
