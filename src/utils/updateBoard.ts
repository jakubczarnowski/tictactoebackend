import Tile from "../types/Tile";

const updateBoard = (board: Tile[][], row: number, col: number, tile: Tile): Tile[][] => {
	const newBoard = [...board];
	newBoard[row][col] = tile;
	return newBoard;
};
export default updateBoard;
