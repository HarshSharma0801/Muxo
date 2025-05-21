import React, { createContext, useContext, useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const initializeSocket = () => {
    if (!socketRef.current) {
      socketRef.current = io("http://localhost:3030", {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ["websocket"],
      });

      socketRef.current.on("connect", () => {
        console.log("Socket connected");
        setIsConnected(true);
      });

      socketRef.current.on("disconnect", () => {
        console.log("Socket disconnected");
        setIsConnected(false);
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        setIsConnected(false);
      });

      setSocket(socketRef.current);
    }
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  };

  // Initialize socket on mount
  useEffect(() => {
    initializeSocket();

    // Cleanup on unmount
    return () => {
      disconnectSocket();
    };
  }, []); // Empty dependency array to run only on mount/unmount

  return (
    <SocketContext.Provider
      value={{ socket, initializeSocket, disconnectSocket, isConnected }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};