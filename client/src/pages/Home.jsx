import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

const Home = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const router = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center overflow-hidden">
      <div className="text-center px-6 py-16">
        <div
          className={`transform transition-all duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Muxo
          </h1>

          <p className="text-xl md:text-2xl text-gray-200 max-w-2xl mx-auto mb-10">
            Connect with anyone, anywhere with our high-quality video
            conferencing platform
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                router("/join");
              }}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-full transition transform hover:scale-105 duration-300"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
