import { Response } from "express";
import { SocketAddress } from "net";
import { Socket } from "socket.io";
import GameRoom from "./types/GameRoom";
import Tile from "./types/Tile";
import { findRoomForSocket } from "./utils/roomUtils";
import updateBoard from "./utils/updateBoard";

const express = require("express");
const app = express();
const PORT = process.env.PORT || 4000;

const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

let gameRooms: GameRoom[] = [];

server.listen(PORT, () => {
	console.log("listening on *:" + PORT);
});
io.on("connection", (socket: Socket) => {
	console.log("a user connected");
	socket.on("user:connecting", (roomId: string) => {
		const foundRoom = gameRooms.find((x) => x.roomId === roomId);
		const startingTile = Math.random() < 0.5 ? Tile.X : Tile.O;
		if (!foundRoom) {
			gameRooms = [
				...gameRooms,
				{
					roomId: roomId,
					hostId: socket.id,
					hostTile: startingTile,
					opponentTile: startingTile === Tile.X ? Tile.O : Tile.X,
					rematchRequested: false,
					board: [
						[Tile.NONE, Tile.NONE, Tile.NONE],
						[Tile.NONE, Tile.NONE, Tile.NONE],
						[Tile.NONE, Tile.NONE, Tile.NONE],
					],
					currentTurn: startingTile === Tile.X ? "host" : "opponent",
				},
			];
			socket.join(roomId);
			socket.emit("room:waiting");
			socket.emit("player:setTile", startingTile);
			console.log(`user ${socket.id} created the room: ${roomId}`);
			return;
		}

		if (foundRoom.opponentId) {
			socket.emit("room:full");
			console.log(`room ${roomId} is full!`);
			return;
		}
		gameRooms = gameRooms.map((gameRoom) =>
			gameRoom.roomId === foundRoom.roomId ? ({ ...foundRoom, opponentId: socket.id } as GameRoom) : gameRoom
		);
		socket.join(roomId);
		socket.emit("player:setTile", foundRoom.opponentTile);
		io.to(foundRoom.roomId).emit("room:playing");
	});
	socket.on("player:pickTile", (spot: { row: number; col: number }) => {
		const foundRoom = findRoomForSocket(gameRooms, socket.id);
		console.log("emmited");

		if (!foundRoom) {
			socket.emit("server:error");
			return;
		}
		console.log(foundRoom);
		if (foundRoom.hostId === socket.id) {
			if (foundRoom.currentTurn === "host") {
				gameRooms = gameRooms.map((gameRoom) =>
					gameRoom.roomId === foundRoom.roomId
						? ({ ...foundRoom, board: updateBoard(gameRoom.board, spot.row, spot.col, foundRoom.hostTile), currentTurn: "opponent" } as GameRoom)
						: gameRoom
				);
				io.to(foundRoom.opponentId).emit("player:opponentPick", spot);
			}
		} else {
			if (foundRoom.currentTurn === "opponent") {
				gameRooms = gameRooms.map((gameRoom) =>
					gameRoom.roomId === foundRoom.roomId
						? ({ ...foundRoom, board: updateBoard(gameRoom.board, spot.row, spot.col, foundRoom.opponentTile), currentTurn: "host" } as GameRoom)
						: gameRoom
				);
				io.to(foundRoom.hostId).emit("player:opponentPick", spot);
			}
		}
	});
	socket.on("room:suggestRematch", () => {
		const foundRoom = findRoomForSocket(gameRooms, socket.id);

		if (!foundRoom) {
			socket.emit("server:error");
			return;
		}
		if (!foundRoom.rematchRequested) {
			gameRooms = gameRooms.map((gameRoom) =>
				gameRoom.roomId === foundRoom.roomId ? ({ ...foundRoom, rematchRequested: true } as GameRoom) : gameRoom
			);
			socket.to(foundRoom.roomId).emit("room:rematchSuggested");
		} else {
			gameRooms = gameRooms.map((gameRoom) =>
				gameRoom.roomId === foundRoom.roomId
					? ({
							...foundRoom,
							rematchRequested: false,
							opponentTile: gameRoom.hostTile,
							hostTile: gameRoom.opponentTile,
							board: [
								[Tile.NONE, Tile.NONE, Tile.NONE],
								[Tile.NONE, Tile.NONE, Tile.NONE],
								[Tile.NONE, Tile.NONE, Tile.NONE],
							],
					  } as GameRoom)
					: gameRoom
			);
			socket.emit("room:playRematch");
			socket.to(foundRoom.roomId).emit("room:playRematch");
			io.to(foundRoom.hostId).emit("player:setTile", foundRoom.opponentTile);
			io.to(foundRoom.opponentId).emit("player:setTile", foundRoom.hostTile);
		}
	});
});
io.of("/").adapter.on("leave-room", (roomId: string, userId: string) => {
	if (roomId !== userId) {
		console.log(`user ${userId} has left the room ${roomId}`);
		io.to(roomId).emit("room:left");
	}
});

io.of("/").adapter.on("delete-room", (roomId: string) => {
	const foundRoom = gameRooms.find((x) => x.roomId === roomId);
	if (foundRoom) {
		gameRooms = gameRooms.filter((x) => x.roomId !== roomId);
	}
});
