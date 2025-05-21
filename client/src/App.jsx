import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./pages/Home";
import Join from "./pages/Join";
import Stream from "./pages/Stream";
import Watch from "./pages/Watch";
import { SocketProvider } from "./context/socket-context";
import { StreamProvider } from "./context/stream-context";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/join",
    element: <Join />,
  },
  {
    path: "/stream",
    element: <Stream />,
  },
  {
    path: "/watch",
    element: <Watch />,
  },
]);

function App() {
  return (
    <SocketProvider>
      <StreamProvider>
        <RouterProvider router={router} />;
      </StreamProvider>
    </SocketProvider>
  );
}

export default App;
