// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV2Router} from "./interfaces/IUniswapV2Router.sol";
import {IUniswapV3Router} from "./interfaces/IUniswapV3Router.sol";
import {ICurvePool} from "./interfaces/ICurvePool.sol";

interface IBalancerVault {
    enum SwapKind { GIVEN_IN, GIVEN_OUT }

    struct SingleSwap {
        bytes32 poolId;
        SwapKind kind;
        address assetIn;
        address assetOut;
        uint256 amount;
        bytes userData;
    }

    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address recipient;
        bool toInternalBalance;
    }

    function swap(
        SingleSwap calldata singleSwap,
        FundManagement calldata funds,
        uint256 limit,
        uint256 deadline
    ) external payable returns (uint256 amountCalculated);
}

contract FlashLoanArbitrage is FlashLoanSimpleReceiverBase, Ownable, ReentrancyGuard {
    enum DexType {
        UniswapV2,
        UniswapV3,
        SushiSwap,
        PancakeSwap,
        Curve,
        BalancerV2
    }

    error Unauthorized();
    error InsufficientProfit(uint256 profit, uint256 totalDebt);
    error MinProfitNotMet(uint256 profit, uint256 minProfit);
    error SwapFailed(DexType dex, address tokenIn, address tokenOut);
    error InvalidDexType(DexType dex);
    error RepaymentFailed(address token, uint256 amount);
    error WithdrawFailed(address token, uint256 amount);

    event ArbitrageExecuted(
        address indexed tokenBorrow,
        uint256 amount,
        uint256 profit,
        uint8 buyDex,
        uint8 sellDex
    );

    event ProfitWithdrawn(address indexed token, uint256 amount);

    struct ArbitrageParams {
        address tokenBorrow;
        address tokenTarget;
        uint256 borrowAmount;
        DexType buyDex;
        DexType sellDex;
        uint24 v3FeeBuy;
        uint24 v3FeeSell;
        uint256 minProfit;
    }

    IUniswapV2Router private constant UNI_V2_ROUTER = IUniswapV2Router(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    IUniswapV2Router private constant SUSHI_ROUTER = IUniswapV2Router(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    IUniswapV2Router private constant PANCAKE_ROUTER = IUniswapV2Router(0x10ED43C718714eb63d5aA57B78B54704E256024E);
    IUniswapV3Router private constant UNI_V3_ROUTER = IUniswapV3Router(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    ICurvePool private constant CURVE_POOL = ICurvePool(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    IBalancerVault private constant BALANCER_VAULT = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

    constructor(IPoolAddressesProvider provider) FlashLoanSimpleReceiverBase(provider) {}

    function executeArbitrage(ArbitrageParams calldata params) external onlyOwner {
        bytes memory encodedParams = abi.encode(params);
        POOL.flashLoanSimple(
            address(this),
            params.tokenBorrow,
            params.borrowAmount,
            encodedParams,
            0
        );
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override nonReentrant returns (bool) {
        if (msg.sender != address(POOL)) revert Unauthorized();
        if (initiator != address(this)) revert Unauthorized();

        ArbitrageParams memory arb = abi.decode(params, (ArbitrageParams));
        uint256 amountBorrowed = amount;
        uint256 amountAfterBuy = _swap(
            arb.buyDex,
            arb.tokenBorrow,
            arb.tokenTarget,
            amountBorrowed,
            1,
            arb.v3FeeBuy
        );

        uint256 amountAfterSell = _swap(
            arb.sellDex,
            arb.tokenTarget,
            arb.tokenBorrow,
            amountAfterBuy,
            1,
            arb.v3FeeSell
        );

        uint256 totalDebt = amountBorrowed + premium;
        if (amountAfterSell <= totalDebt) revert InsufficientProfit(amountAfterSell, totalDebt);

        uint256 profit = amountAfterSell - totalDebt;
        if (profit < arb.minProfit) revert MinProfitNotMet(profit, arb.minProfit);

        _approveToken(arb.tokenBorrow, address(POOL), totalDebt);

        emit ArbitrageExecuted(arb.tokenBorrow, amountBorrowed, profit, uint8(arb.buyDex), uint8(arb.sellDex));
        return true;
    }

    function _approveToken(address token, address spender, uint256 amount) internal {
        IERC20 erc20 = IERC20(token);
        uint256 allowance = erc20.allowance(address(this), spender);
        if (allowance < amount) {
            if (allowance > 0) {
                erc20.approve(spender, 0);
            }
            erc20.approve(spender, amount);
        }
    }

    function _swap(
        DexType dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint24 v3Fee
    ) internal returns (uint256) {
        if (tokenIn == tokenOut) {
            return amountIn;
        }

        _approveToken(tokenIn, _getDexSpender(dex), amountIn);

        if (dex == DexType.UniswapV2 || dex == DexType.SushiSwap || dex == DexType.PancakeSwap) {
            address router = _getV2Router(dex);
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;

            uint256[] memory amounts = IUniswapV2Router(router).swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                address(this),
                block.timestamp + 300
            );
            return amounts[amounts.length - 1];
        }

        if (dex == DexType.UniswapV3) {
            IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: v3Fee,
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            });

            return UNI_V3_ROUTER.exactInputSingle(params);
        }

        if (dex == DexType.Curve) {
            (int128 i, int128 j) = _getCurveIndexes(tokenIn, tokenOut);
            return CURVE_POOL.exchange_underlying(i, j, amountIn, amountOutMin);
        }

        if (dex == DexType.BalancerV2) {
            IBalancerVault.SingleSwap memory singleSwap = IBalancerVault.SingleSwap({
                poolId: bytes32(0),
                kind: IBalancerVault.SwapKind.GIVEN_IN,
                assetIn: tokenIn,
                assetOut: tokenOut,
                amount: amountIn,
                userData: ""
            });
            IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
                sender: address(this),
                fromInternalBalance: false,
                recipient: address(this),
                toInternalBalance: false
            });

            return BALANCER_VAULT.swap(singleSwap, funds, amountOutMin, block.timestamp + 300);
        }

        revert InvalidDexType(dex);
    }

    function _getV2Router(DexType dex) internal pure returns (address) {
        if (dex == DexType.UniswapV2) {
            return address(UNI_V2_ROUTER);
        }
        if (dex == DexType.SushiSwap) {
            return address(SUSHI_ROUTER);
        }
        if (dex == DexType.PancakeSwap) {
            return address(PANCAKE_ROUTER);
        }
        revert InvalidDexType(dex);
    }

    function _getDexSpender(DexType dex) internal pure returns (address) {
        if (dex == DexType.UniswapV2) {
            return address(UNI_V2_ROUTER);
        }
        if (dex == DexType.SushiSwap) {
            return address(SUSHI_ROUTER);
        }
        if (dex == DexType.PancakeSwap) {
            return address(PANCAKE_ROUTER);
        }
        if (dex == DexType.UniswapV3) {
            return address(UNI_V3_ROUTER);
        }
        if (dex == DexType.Curve) {
            return address(CURVE_POOL);
        }
        if (dex == DexType.BalancerV2) {
            return address(BALANCER_VAULT);
        }
        revert InvalidDexType(dex);
    }

    function _getCurveIndexes(address tokenIn, address tokenOut) internal pure returns (int128 i, int128 j) {
        if (tokenIn == 0x6B175474E89094C44Da98b954EedeAC495271d0F && tokenOut == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) {
            return (0, 1);
        }
        if (tokenIn == 0x6B175474E89094C44Da98b954EedeAC495271d0F && tokenOut == 0xdAC17F958D2ee523a2206206994597C13D831ec7) {
            return (0, 2);
        }
        if (tokenIn == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 && tokenOut == 0x6B175474E89094C44Da98b954EedeAC495271d0F) {
            return (1, 0);
        }
        if (tokenIn == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 && tokenOut == 0xdAC17F958D2ee523a2206206994597C13D831ec7) {
            return (1, 2);
        }
        if (tokenIn == 0xdAC17F958D2ee523a2206206994597C13D831ec7 && tokenOut == 0x6B175474E89094C44Da98b954EedeAC495271d0F) {
            return (2, 0);
        }
        if (tokenIn == 0xdAC17F958D2ee523a2206206994597C13D831ec7 && tokenOut == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) {
            return (2, 1);
        }
        revert SwapFailed(DexType.Curve, tokenIn, tokenOut);
    }

    function withdrawToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert WithdrawFailed(token, 0);
        if (!IERC20(token).transfer(owner(), balance)) revert WithdrawFailed(token, balance);
        emit ProfitWithdrawn(token, balance);
    }

    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert WithdrawFailed(address(0), 0);
        (bool success, ) = owner().call{value: balance}("");
        if (!success) revert WithdrawFailed(address(0), balance);
        emit ProfitWithdrawn(address(0), balance);
    }

    receive() external payable {}
}
