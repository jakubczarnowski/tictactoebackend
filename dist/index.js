"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Tile_1 = __importDefault(require("./types/Tile"));
const roomUtils_1 = require("./utils/roomUtils");
const updateBoard_1 = __importDefault(require("./utils/updateBoard"));
const express = require("express");
const app = express();
const PORT = process.env.PORT || 4000;
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });
let gameRooms = [];
server.listen(PORT, () => {
    console.log("listening on *:" + PORT);
});
io.on("connection", (socket) => {
    console.log("a user connected");
    socket.on("user:connecting", (roomId) => {
        const foundRoom = gameRooms.find((x) => x.roomId === roomId);
        const startingTile = Math.random() < 0.5 ? Tile_1.default.X : Tile_1.default.O;
        if (!foundRoom) {
            gameRooms = [
                ...gameRooms,
                {
                    roomId: roomId,
                    hostId: socket.id,
                    hostTile: startingTile,
                    opponentTile: startingTile === Tile_1.default.X ? Tile_1.default.O : Tile_1.default.X,
                    rematchRequested: false,
                    board: [
                        [Tile_1.default.NONE, Tile_1.default.NONE, Tile_1.default.NONE],
                        [Tile_1.default.NONE, Tile_1.default.NONE, Tile_1.default.NONE],
                        [Tile_1.default.NONE, Tile_1.default.NONE, Tile_1.default.NONE],
                    ],
                    currentTurn: startingTile === Tile_1.default.X ? "host" : "opponent",
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
        gameRooms = gameRooms.map((gameRoom) => gameRoom.roomId === foundRoom.roomId ? Object.assign(Object.assign({}, foundRoom), { opponentId: socket.id }) : gameRoom);
        socket.join(roomId);
        socket.emit("player:setTile", foundRoom.opponentTile);
        io.to(foundRoom.roomId).emit("room:playing");
    });
    socket.on("player:pickTile", (spot) => {
        const foundRoom = (0, roomUtils_1.findRoomForSocket)(gameRooms, socket.id);
        console.log("emmited");
        if (!foundRoom) {
            socket.emit("server:error");
            return;
        }
        console.log(foundRoom);
        if (foundRoom.hostId === socket.id) {
            if (foundRoom.currentTurn === "host") {
                gameRooms = gameRooms.map((gameRoom) => gameRoom.roomId === foundRoom.roomId
                    ? Object.assign(Object.assign({}, foundRoom), { board: (0, updateBoard_1.default)(gameRoom.board, spot.row, spot.col, foundRoom.hostTile), currentTurn: "opponent" })
                    : gameRoom);
                io.to(foundRoom.opponentId).emit("player:opponentPick", spot);
            }
        }
        else {
            if (foundRoom.currentTurn === "opponent") {
                gameRooms = gameRooms.map((gameRoom) => gameRoom.roomId === foundRoom.roomId
                    ? Object.assign(Object.assign({}, foundRoom), { board: (0, updateBoard_1.default)(gameRoom.board, spot.row, spot.col, foundRoom.opponentTile), currentTurn: "host" })
                    : gameRoom);
                io.to(foundRoom.hostId).emit("player:opponentPick", spot);
            }
        }
    });
    socket.on("room:suggestRematch", () => {
        const foundRoom = (0, roomUtils_1.findRoomForSocket)(gameRooms, socket.id);
        if (!foundRoom) {
            socket.emit("server:error");
            return;
        }
        if (!foundRoom.rematchRequested) {
            gameRooms = gameRooms.map((gameRoom) => gameRoom.roomId === foundRoom.roomId ? Object.assign(Object.assign({}, foundRoom), { rematchRequested: true }) : gameRoom);
            socket.to(foundRoom.roomId).emit("room:rematchSuggested");
        }
        else {
            gameRooms = gameRooms.map((gameRoom) => gameRoom.roomId === foundRoom.roomId
                ? Object.assign(Object.assign({}, foundRoom), { rematchRequested: false, opponentTile: gameRoom.hostTile, hostTile: gameRoom.opponentTile, board: [
                        [Tile_1.default.NONE, Tile_1.default.NONE, Tile_1.default.NONE],
                        [Tile_1.default.NONE, Tile_1.default.NONE, Tile_1.default.NONE],
                        [Tile_1.default.NONE, Tile_1.default.NONE, Tile_1.default.NONE],
                    ] })
                : gameRoom);
            socket.emit("room:playRematch");
            socket.to(foundRoom.roomId).emit("room:playRematch");
            io.to(foundRoom.hostId).emit("player:setTile", foundRoom.opponentTile);
            io.to(foundRoom.opponentId).emit("player:setTile", foundRoom.hostTile);
        }
    });
});
io.of("/").adapter.on("leave-room", (roomId, userId) => {
    if (roomId !== userId) {
        console.log(`user ${userId} has left the room ${roomId}`);
        io.to(roomId).emit("room:left");
    }
});
io.of("/").adapter.on("delete-room", (roomId) => {
    const foundRoom = gameRooms.find((x) => x.roomId === roomId);
    if (foundRoom) {
        gameRooms = gameRooms.filter((x) => x.roomId !== roomId);
    }
});
