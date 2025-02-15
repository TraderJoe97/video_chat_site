import React from "react";
import VideoChat from "./components/VideoChat";

const App: React.FC = () => {
  return (
    <div className="flex justify-center items-center h-screen bg-gray-800">
      <VideoChat />
    </div>
  );
};

export default App;
