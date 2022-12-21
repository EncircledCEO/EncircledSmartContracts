// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Encircled is Context, IERC20, Ownable {
    string private constant _name = "Encircled";
    string private constant _symbol = "ENCD";
    uint8 private constant _decimals = 18;

    uint256 private _tTotal = 200_000_000 * 10 ** 18; //total supply
    uint256 private _rTotal = (type(uint256).max -
        (type(uint256).max % _tTotal)); //used for computation of real supply supply (redistribution)

    uint256 public _taxFee = 8; //8%
    uint256 private _previousTaxFee = _taxFee;

    uint256 public _transactionFee = 5; //5%
    uint256 private _previousTransactionFee = _transactionFee;
    address public constant _transactionWallet =
        0xe325854cfCC89546d9c9bfCFa32967864287bD0C; //transaction wallet

    uint256 private _tFeeTotal;
    address[] private _excluded;

    mapping(address => uint256) private _rOwned;
    mapping(address => uint256) private _tOwned;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private _isExcludedFromFee;
    mapping(address => bool) private _isExcluded;

    struct FeeData {
        uint256 tFee;
        uint256 tTransaction;
    }

    /**
     * @dev initalizing the contract
     * @notice excluding owner(deployer) and address from the fees and assigning the total supply to the deployer
     */
    constructor() {
        _rOwned[_msgSender()] = _rTotal;
        //exclude owner and this contract from the fee
        _isExcludedFromFee[owner()] = true;
        _isExcludedFromFee[address(this)] = true;
        emit Transfer(address(0), _msgSender(), _tTotal);
    }

    /**
     * @dev transfer of tokens from own wallet (ERC20 token standard)
     * @param to receiving address
     * @param amount amount of tokens to send
     */
    function transfer(
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return true;
    }

    /**
     * @dev transfer of approved tokens (ERC20 token standard)
     * @param from sending address
     * @param to receiving address
     * @param amount amount of tokens to send
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    /**
     * @dev approve another address to spend tokens (ERC20 token standard)
     * @param spender address that is granted the ability to spend tokens
     * @param amount amount of tokens spender is allowed to spend
     */
    function approve(
        address spender,
        uint256 amount
    ) public virtual override returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, amount);
        return true;
    }

    /**
     * @dev increases token amount address is allowed to spend (ERC20 token standard)
     * @param spender address that is granted the ability to spend tokens
     * @param addedValue allowed amount added of tokens spender is allowed to use
     */
    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, allowance(owner, spender) + addedValue);
        return true;
    }

    /**
     * @dev decreases token amount address is allowed to spend (ERC20 token standard)
     * @param spender address that is granted the ability to spend tokens
     * @param subtractedValue allowed amount subtracted of tokens spender is allowed to use
     */
    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public virtual returns (bool) {
        address owner = _msgSender();
        uint256 currentAllowance = allowance(owner, spender);
        require(
            currentAllowance >= subtractedValue,
            "ERC20: decreased allowance below zero"
        );
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }

        return true;
    }

    /**
     * @dev including address in reward (receives a portion of distributed tokens)
     * @notice all addresses are automatically included only to include an adress after excluding it
     * @param account address that included
     */
    function includeInReward(address account) public onlyOwner {
        require(_isExcluded[account], "Account is already excluded");
        for (uint256 i = 0; i < _excluded.length; i++) {
            if (_excluded[i] == account) {
                _excluded[i] = _excluded[_excluded.length - 1];
                _tOwned[account] = 0;
                _isExcluded[account] = false;
                _excluded.pop();
                break;
            }
        }
    }

    /**
     * @dev excluding address from reward (will not receive of distributed tokens)
     * @param account address that is excluded
     */
    function excludeFromReward(address account) public onlyOwner {
        require(!_isExcluded[account], "Account is already excluded");
        if (_rOwned[account] > 0) {
            _tOwned[account] = tokenFromReflection(_rOwned[account]);
        }
        _isExcluded[account] = true;
        _excluded.push(account);
    }

    /**
     * @dev including address in fee (has to pay the fee when sending tokens (redistribution, development))
     * @notice all addresses are automatically included only to include an adress after excluding it
     * @param account address that is included
     */
    function includeInFee(address account) public onlyOwner {
        _isExcludedFromFee[account] = false;
    }

    /**
     * @dev excluded address from fee (won't pay a fee when sending tokens (redistribution, development))
     * @param account address that is excluded
     */
    function excludeFromFee(address account) public onlyOwner {
        _isExcludedFromFee[account] = true;
    }

    /**
     * @dev distributes spezifed amount received reflected tokens to all other address (detucts it from caller address)
     * @param tAmount amount to distribute
     */
    function deliver(uint256 tAmount) public {
        address sender = _msgSender();
        require(
            !_isExcluded[sender],
            "Excluded addresses cannot call this function"
        );
        (uint256 rAmount, , , , , ) = _getValues(tAmount);
        _rOwned[sender] = _rOwned[sender] - rAmount;
        _rTotal = _rTotal - rAmount;
        _tFeeTotal = _tFeeTotal + tAmount;
    }

    //returning informations to caller:
    function name() public pure returns (string memory) {
        return _name;
    }

    function symbol() public pure returns (string memory) {
        return _symbol;
    }

    function decimals() public pure returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view override returns (uint256) {
        return _tTotal;
    }

    function totalFees() public view returns (uint256) {
        return _tFeeTotal;
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (_isExcluded[account]) return _tOwned[account];
        return tokenFromReflection(_rOwned[account]);
    }

    function allowance(
        address owner,
        address spender
    ) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function isExcludedFromFee(address account) public view returns (bool) {
        return _isExcludedFromFee[account];
    }

    function isExcludedFromReward(address account) public view returns (bool) {
        return _isExcluded[account];
    }

    function reflectionFromToken(
        uint256 tAmount,
        bool deductTransferFee
    ) public view returns (uint256) {
        require(tAmount <= _tTotal, "Amount must be less than supply");
        if (!deductTransferFee) {
            (uint256 rAmount, , , , , ) = _getValues(tAmount);
            return rAmount;
        } else {
            (, uint256 rTransferAmount, , , , ) = _getValues(tAmount);
            return rTransferAmount;
        }
    }

    function tokenFromReflection(
        uint256 rAmount
    ) public view returns (uint256) {
        require(
            rAmount <= _rTotal,
            "Amount must be less than total reflections"
        );
        uint256 currentRate = _getRate();
        return rAmount / currentRate;
    }

    /**
     * @notice Supporting functions:
     */
    //checks whetever address is allowed to spend balance
    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(
                currentAllowance >= amount,
                "ERC20: insufficient allowance"
            );
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

    //updates reflected fee
    function _reflectFee(uint256 rFee, uint256 tFee) private {
        _rTotal = _rTotal - rFee;
        _tFeeTotal = _tFeeTotal + tFee;
    }

    //get spezific values (see return)
    function _getValues(
        uint256 tAmount
    )
        private
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256)
    {
        (uint256 tTransferAmount, FeeData memory tFeeData) = _getTValues(
            tAmount
        );
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee) = _getRValues(
            tAmount,
            tFeeData,
            _getRate()
        );
        return (
            rAmount,
            rTransferAmount,
            rFee,
            tTransferAmount,
            tFeeData.tFee,
            tFeeData.tTransaction
        );
    }

    //calculation of tax fees and return fee and transfer amount
    function _getTValues(
        uint256 tAmount
    ) private view returns (uint256, FeeData memory) {
        uint256 tFee = calculateTaxFee(tAmount);
        uint256 tTransaction = calculateTransactionFee(tAmount);
        uint256 tTransferAmount = tAmount - tFee - tTransaction;
        FeeData memory tFeeData = FeeData(tFee, tTransaction);
        return (tTransferAmount, tFeeData);
    }

    //calculation of tax fees of reflected tokens and returns fee and transfer amount
    function _getRValues(
        uint256 tAmount,
        FeeData memory tFeeData,
        uint256 currentRate
    ) private pure returns (uint256, uint256, uint256) {
        uint256 rAmount = tAmount * currentRate;
        uint256 rFee = tFeeData.tFee * currentRate;
        uint256 rTransaction = tFeeData.tTransaction * currentRate;
        uint256 rTransferAmount = rAmount - rFee - rTransaction;
        return (rAmount, rTransferAmount, rFee);
    }

    //get rate to calculate amount of reflected tokens
    function _getRate() private view returns (uint256) {
        (uint256 rSupply, uint256 tSupply) = _getCurrentSupply();
        return rSupply / tSupply;
    }

    //get reflected and normal supply
    function _getCurrentSupply() private view returns (uint256, uint256) {
        uint256 rSupply = _rTotal;
        uint256 tSupply = _tTotal;
        for (uint256 i = 0; i < _excluded.length; i++) {
            if (
                _rOwned[_excluded[i]] > rSupply ||
                _tOwned[_excluded[i]] > tSupply
            ) return (_rTotal, _tTotal);
            rSupply = rSupply - _rOwned[_excluded[i]];
            tSupply = tSupply - _tOwned[_excluded[i]];
        }
        if (rSupply < _rTotal / (_tTotal)) return (_rTotal, _tTotal);
        return (rSupply, tSupply);
    }

    //supportint function for transfering tokens
    function _takeTransaction(uint256 tTransaction) private {
        uint256 currentRate = _getRate();
        uint256 rTransaction = tTransaction * currentRate;
        _rOwned[_transactionWallet] =
            _rOwned[_transactionWallet] +
            rTransaction;
        if (_isExcluded[_transactionWallet])
            _tOwned[_transactionWallet] =
                _tOwned[_transactionWallet] +
                tTransaction;
    }

    //calcutes tax fee
    function calculateTaxFee(uint256 _amount) private view returns (uint256) {
        return (_amount * _taxFee) / (10 ** 2);
    }

    //calcutes transaction fee
    function calculateTransactionFee(
        uint256 _amount
    ) private view returns (uint256) {
        return (_amount * _transactionFee) / (10 ** 2);
    }

    //remove all fees
    function removeAllFee() private {
        if (_taxFee == 0 && _transactionFee == 0) return;

        _previousTaxFee = _taxFee;
        _previousTransactionFee = _transactionFee;

        _taxFee = 0;
        _transactionFee = 0;
    }

    //restore all fees
    function restoreAllFee() private {
        _taxFee = _previousTaxFee;
        _transactionFee = _previousTransactionFee;
    }

    //execute approve function
    function _approve(address owner, address spender, uint256 amount) private {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    //execute transfer function part 1
    function _transfer(address from, address to, uint256 amount) private {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        require(amount > 0, "Transfer amount must be greater than zero");
        //indicates if fee should be deducted from transfer
        bool takeFee = true;
        //if any account belongs to _isExcludedFromFee account then remove the fee
        if (_isExcludedFromFee[from] || _isExcludedFromFee[to]) {
            takeFee = false;
        }
        //transfer amount, it will take tax
        _tokenTransfer(from, to, amount, takeFee);
    }

    //execute transfer function part 2
    function _tokenTransfer(
        address sender,
        address recipient,
        uint256 amount,
        bool takeFee
    ) private {
        if (!takeFee) removeAllFee();

        if (_isExcluded[sender] && !_isExcluded[recipient]) {
            _transferFromExcluded(sender, recipient, amount);
        } else if (!_isExcluded[sender] && _isExcluded[recipient]) {
            _transferToExcluded(sender, recipient, amount);
        } else if (!_isExcluded[sender] && !_isExcluded[recipient]) {
            _transferStandard(sender, recipient, amount);
        } else if (_isExcluded[sender] && _isExcluded[recipient]) {
            _transferBothExcluded(sender, recipient, amount);
        } else {
            _transferStandard(sender, recipient, amount);
        }

        if (!takeFee) restoreAllFee();
    }

    //execute transfer function part 3
    function _transferStandard(
        address sender,
        address recipient,
        uint256 tAmount
    ) private {
        (
            uint256 rAmount,
            uint256 rTransferAmount,
            uint256 rFee,
            uint256 tTransferAmount,
            uint256 tFee,
            uint256 tTransaction
        ) = _getValues(tAmount);
        _rOwned[sender] = _rOwned[sender] - rAmount;
        _rOwned[recipient] = _rOwned[recipient] + rTransferAmount;
        _takeTransaction(tTransaction);
        _reflectFee(rFee, tFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    //execute transfer if receiving address is excluded
    function _transferToExcluded(
        address sender,
        address recipient,
        uint256 tAmount
    ) private {
        (
            uint256 rAmount,
            uint256 rTransferAmount,
            uint256 rFee,
            uint256 tTransferAmount,
            uint256 tFee,
            uint256 tTransaction
        ) = _getValues(tAmount);
        _rOwned[sender] = _rOwned[sender] - rAmount;
        _tOwned[recipient] = _tOwned[recipient] + tTransferAmount;
        _rOwned[recipient] = _rOwned[recipient] + rTransferAmount;
        _takeTransaction(tTransaction);
        _reflectFee(rFee, tFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    //execute transfer if sending address is excluded
    function _transferFromExcluded(
        address sender,
        address recipient,
        uint256 tAmount
    ) private {
        (
            uint256 rAmount,
            uint256 rTransferAmount,
            uint256 rFee,
            uint256 tTransferAmount,
            uint256 tFee,
            uint256 tTransaction
        ) = _getValues(tAmount);
        _tOwned[sender] = _tOwned[sender] - tAmount;
        _rOwned[sender] = _rOwned[sender] - rAmount;
        _rOwned[recipient] = _rOwned[recipient] + rTransferAmount;
        _takeTransaction(tTransaction);
        _reflectFee(rFee, tFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    //execute transfer if both addresses are excluded
    function _transferBothExcluded(
        address sender,
        address recipient,
        uint256 tAmount
    ) private {
        (
            uint256 rAmount,
            uint256 rTransferAmount,
            uint256 rFee,
            uint256 tTransferAmount,
            uint256 tFee,
            uint256 tTransaction
        ) = _getValues(tAmount);
        _tOwned[sender] = _tOwned[sender] - tAmount;
        _rOwned[sender] = _rOwned[sender] - rAmount;
        _tOwned[recipient] = _tOwned[recipient] + tTransferAmount;
        _rOwned[recipient] = _rOwned[recipient] + rTransferAmount;
        _takeTransaction(tTransaction);
        _reflectFee(rFee, tFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }
}
