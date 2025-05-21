import React from "react";
import { useState } from "react";

const StreamContext = React.createContext();

export const StreamProvider = ({ children }) => {
  const [consumers, setConsumers] = useState({});
  const [AllUsers, setAllUsers] = useState([]);
  const [device, setDevice] = useState(null);

  return (
    <StreamContext.Provider
      value={{
        consumers,
        setConsumers,
        device,
        setDevice,
        AllUsers,
        setAllUsers
      }}
    >
      {children}
    </StreamContext.Provider>
  );
};

export const useStream = () => {
  const context = React.useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStream must be used within a StreamProvider");
  }
  return context;
};
