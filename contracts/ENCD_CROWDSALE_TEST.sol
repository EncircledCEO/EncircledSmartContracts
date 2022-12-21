// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IENCDVesting {
    function createVestingSchedule(
        address _buyer,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration,
        uint256 _slicePeriod,
        uint256 _amounttge,
        uint256 _amount
    ) external;
}

contract ENCD_ICO is Ownable, ReentrancyGuard {
    using SafeERC20 for ERC20;
    ERC20 public USDTtoken; //address of usdt
    ERC20 public DAItoken; //address of dai
    ERC20 public BUSDtoken; //address of busd
    ERC20 public Encircledtoken; //address of the encd token
    IENCDVesting public ENCDtoken; //address of the encdvesting smart contract

    uint256 public seedtokensforsale = 16_000_000 * 10 ** 18; //amount availabe for purchase in seed stage: 8%
    uint256 public privatetokensforsale = 30_000_000 * 10 ** 18; //amount availabe for purchase in private stage: 15%
    uint256 public publictokensforsale = 20_000_000 * 10 ** 18; //amount availabe for purchase in public stage: 20%

    bool public startLock = false; //locking the start function after execution

    uint256 startVTime; //relaese time of the tokens to the buyers (tge), init vesting start

    event StageChanged(uint _e);

    enum Stages {
        none,
        seedstage,
        privatstage,
        publicstage,
        icoEnd
    }

    Stages public currentStage;

    /**
     * @dev initalizes the crowdsale contract
     * @param _tokenaddress address of the encd token
     * @param _vestingscaddress address of the vesting smart contract
     * @param _USDTtokenaddress address of usdt
     */
    constructor(
        address _tokenaddress,
        address _USDTtokenaddress,
        address _vestingscaddress
    ) {
        currentStage = Stages.none;
        Encircledtoken = ERC20(_tokenaddress);
        ENCDtoken = IENCDVesting(_vestingscaddress);
        USDTtoken = ERC20(_USDTtokenaddress);
    }

    /**
     * @dev initalize vesting function/
     * @notice call before the start of the presale
     * @param _starttime sets the relase time in seconts of the purchased tokens (tge)
     * so e.g. 60 * 60 * 24 * 30 = 2592000 would set the tge to 30 days after calling the function
     */
    function startVesting(uint _starttime) external onlyOwner {
        require(startLock == false, "Function already executed");
        startLock = true;
        startVTime = block.timestamp + _starttime;
        startTeamVesting();
    }

    /**
     * @dev function to buy token with USDT
     * @notice first stablecoin needs to be approved (front-end)
     * @param _amount amount of encd tokens buyer wants to purchase
     * @param _id stablecoin used for purchase
     * id 1 = USDT
     * id 2 = DAI
     * id 3 = BUSD
     */
    function buyToken(uint256 _amount, uint _id) public {
        require(_amount > 0, "Amount can't be 0");
        ERC20 stableToken = getCoin(_id);
        uint256 approvedAmount = stableToken.allowance(
            msg.sender,
            address(this)
        );
        uint256 price = getPrice();
        uint256 totalPrice = (_amount * 10) / price;
        require(
            approvedAmount >= totalPrice,
            "Check the token allowance, not enough approved!"
        );
        stableToken.safeTransferFrom(msg.sender, address(this), totalPrice);
        //ICOtoken is in the contract
        transferVesting(msg.sender, _amount);
        //Encircledtoken.transfer(msg.sender, _amount);
    }

    /**
     * @dev function to get the price denomintor for the current stage
     * e.g. seedstage price denominator = 500 => 1/500 = 0.02
     * @return price price denominator of current price
     */
    function getPrice() public view returns (uint256 price) {
        require(
            currentStage == Stages.seedstage ||
                currentStage == Stages.privatstage ||
                currentStage == Stages.publicstage,
            "Sale not active"
        );
        if (currentStage == Stages.seedstage) {
            return 500; //0.02
        } else if (currentStage == Stages.privatstage) {
            return 250; //0.04
        } else if (currentStage == Stages.publicstage) {
            return 125; //0.08
        }
    }

    /**
     * @notice Setting the presale stage
     * @param _value index of stage
     * 0 - none
     * 1 - seed
     * 2 - private
     * 3 - public
     * 4 - end
     */
    function setStage(uint _value) public onlyOwner {
        require(uint(Stages.icoEnd) >= _value, "Stage doesn't exist");
        currentStage = Stages(_value);
        emit StageChanged(_value);
    }

    /**
     * @dev function use to withdraw the stablecoins from the contract
     * @param amount amount of the stablecoin
     * @param id stabelcoin:
     * id 1 = USDT
     * id 2 = DAI
     * id 3 = BUSD
     */
    function withdraw(
        uint256 amount,
        uint id
    ) external onlyOwner returns (bool success) {
        ERC20 stableToken = getCoin(id);
        require(
            stableToken.balanceOf(address(this)) >= amount,
            "Not enough funds on the contract"
        );
        stableToken.safeTransfer(msg.sender, amount);
        return true;
    }

    /**
     * @dev create vesting schedule after a purchase
     * @param _buyer address of buyer
     * @param _amount purchased amount
     */
    function transferVesting(address _buyer, uint _amount) internal {
        if (currentStage == Stages.seedstage) {
            require(
                seedtokensforsale > 0,
                "All tokens in this stage sold, wait for the next stage"
            );
            require(
                seedtokensforsale >= _amount,
                "Not enough tokens left for purchase in this stage"
            );
            seedtokensforsale -= _amount;
            ENCDtoken.createVestingSchedule(
                _buyer,
                startVTime,
                0,
                60 * 60 * 24 * 30 * 12,
                60 * 60 * 24,
                (_amount * 625) / 10000, //6.25%
                _amount
            );
        } else if (currentStage == Stages.privatstage) {
            require(
                privatetokensforsale > 0,
                "All tokens in this stage sold, wait for the next stage"
            );
            require(
                privatetokensforsale >= _amount,
                "Not enough tokens left for purchase in this stage"
            );
            privatetokensforsale -= _amount;
            ENCDtoken.createVestingSchedule(
                _buyer,
                startVTime,
                60 * 60 * 24 * 30 * 1,
                60 * 60 * 24 * 30 * 12,
                60 * 60 * 24,
                (_amount * 1250) / 10000, //12.5%
                _amount
            );
        } else if (currentStage == Stages.publicstage) {
            require(publictokensforsale > 0, "All tokens sold");
            require(
                publictokensforsale >= _amount,
                "Not enough tokens left for purchase in this stage"
            );
            publictokensforsale -= _amount;
            ENCDtoken.createVestingSchedule(
                _buyer,
                startVTime,
                60 * 60 * 24 * 30 * 2,
                60 * 60 * 24 * 30 * 6,
                60 * 60 * 24,
                (_amount * 2500) / 10000, //25%
                _amount
            );
        }
    }

    /**
     * @dev creation of the team vesting schedule
     * called after vesting start
     */
    function startTeamVesting() internal {
        ENCDtoken.createVestingSchedule(
            0x02346e9d0173CE68237330CF8305025F2A54520C,
            startVTime,
            60 * 60 * 24 * 30 * 12,
            60 * 60 * 24 * 30 * 36,
            60 * 60 * 24,
            0,
            4000000
        );
        ENCDtoken.createVestingSchedule(
            0x5F50FE907829c957fF3db0555DcE07729c005618,
            startVTime,
            60 * 60 * 24 * 30 * 12,
            60 * 60 * 24 * 30 * 36,
            60 * 60 * 24,
            0,
            4000000
        );
        ENCDtoken.createVestingSchedule(
            0x921883944a96a7fDDa44588970BE8eb58c3f773a,
            startVTime,
            60 * 60 * 24 * 30 * 12,
            60 * 60 * 24 * 30 * 36,
            60 * 60 * 24,
            0,
            1000000
        );
        ENCDtoken.createVestingSchedule(
            0xFb87EeD8bDCfF1494FAF79d25AE6034E09111642,
            startVTime,
            60 * 60 * 24 * 30 * 12,
            60 * 60 * 24 * 30 * 36,
            60 * 60 * 24,
            0,
            2000000
        );
        ENCDtoken.createVestingSchedule(
            0x63189aE134bb90E7c1E0DBd5c3f342E95a845737,
            startVTime,
            60 * 60 * 24 * 30 * 12,
            60 * 60 * 24 * 30 * 36,
            60 * 60 * 24,
            0,
            2000000
        );
        ENCDtoken.createVestingSchedule(
            0xeaD96e2eaCa0d0eEDcFD0888B4905994ba69D35A,
            startVTime,
            60 * 60 * 24 * 30 * 12,
            60 * 60 * 24 * 30 * 36,
            60 * 60 * 24,
            0,
            7000000
        );
    }

    /**
     * @dev get the stablecoin
     * @param _id id of stablecoin
     * @return _token returns stablecoin
     */
    function getCoin(uint _id) internal view returns (ERC20 _token) {
        require(_id <= 3 && 0 < _id, "invalid token id");
        if (_id == 1) {
            return USDTtoken;
        }
        if (_id == 2) {
            return DAItoken;
        }
        if (_id == 3) {
            return BUSDtoken;
        }
    }
}
