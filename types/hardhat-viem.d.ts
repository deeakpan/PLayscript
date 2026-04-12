/**
 * Pulls in hardhat-viem module augmentation so hre.viem is typed for scripts/
 * when this file is included by tsconfig.
 */
export {};

import "@nomicfoundation/hardhat-viem/internal/type-extensions";
