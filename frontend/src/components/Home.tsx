import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import { getSocketUrl } from "../utils/getSocketUrl";

const SOCKET_URL = getSocketUrl();

function Home() {
  const [roomId, setRoomId] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const socket: Socket = io(SOCKET_URL, {
        transports: ["polling", "websocket"], // Try polling first, then upgrade to websocket
        timeout: 10000,
        upgrade: true, // Allow upgrade to websocket
      });

      // Set up timeout
      const timeout = setTimeout(() => {
        console.error("Connection timeout");
        alert(
          "Connection timeout. Please check if the backend server is running."
        );
        setIsCreating(false);
        socket.disconnect();
      }, 10000);

      socket.on("connect", () => {
        console.log("Connected to server");
        clearTimeout(timeout);
        socket.emit("createRoom");
      });

      socket.on("connect_error", (error: Error) => {
        console.error("Connection error:", error);
        clearTimeout(timeout);
        alert(
          "Failed to connect to server. Please check if the backend is running on port 3004."
        );
        setIsCreating(false);
        socket.disconnect();
      });

      socket.on("roomCreated", (data: any) => {
        console.log("Room created:", data);
        clearTimeout(timeout);
        const newRoomId = data.roomId || data.data?.roomId;
        if (newRoomId) {
          socket.disconnect();
          navigate(`/room/${newRoomId}`);
        } else {
          alert("Failed to create room. Invalid response from server.");
          setIsCreating(false);
          socket.disconnect();
        }
      });

      socket.on("error", (error: any) => {
        console.error("Error creating room:", error);
        clearTimeout(timeout);
        const errorMessage =
          error.message ||
          error.data?.message ||
          "Failed to create room. Please try again.";
        alert(errorMessage);
        setIsCreating(false);
        socket.disconnect();
      });
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to create room. Please try again.");
      setIsCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      navigate(`/room/${roomId.trim()}`);
    } else {
      alert("Please enter a room ID");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 w-full max-w-md">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 text-center mb-2">
          Video Call App
        </h1>
        <p className="text-gray-600 text-center mb-6 sm:mb-8 text-sm sm:text-base">
          Create or join a video call room
        </p>

        <div className="space-y-4 sm:space-y-6">
          <button
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 sm:py-4 px-6 rounded-lg font-semibold text-sm sm:text-base uppercase tracking-wide shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            onClick={handleCreateRoom}
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "Create Room"}
          </button>

          <div className="relative flex items-center my-4 sm:my-6">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-500 text-xs sm:text-sm font-medium">
              OR
            </span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
              className="w-full px-4 py-3 sm:py-3.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base transition-colors"
            />
            <button
              className="w-full bg-green-500 hover:bg-green-600 text-white py-3 sm:py-4 px-6 rounded-lg font-semibold text-sm sm:text-base uppercase tracking-wide shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
              onClick={handleJoinRoom}
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
