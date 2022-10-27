"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const updateBoard = (board, row, col, tile) => {
    const newBoard = [...board];
    newBoard[row][col] = tile;
    return newBoard;
};
exports.default = updateBoard;
