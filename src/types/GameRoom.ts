import Tile from "./Tile";

export default interface GameRoom {
	roomId: string;
	hostId: string;
	opponentId?: string;
	hostTile: Tile;
	opponentTile: Tile;
	rematchRequested: boolean;
	board: Tile[][];
	currentTurn: "host" | "opponent";
}
