import { useRouteError, Link } from "react-router-dom";

const Error = () => {
  const error = useRouteError();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
        <h1 className="text-4xl font-bold text-red-500 mb-4">Oops!</h1>
        <p className="text-xl text-gray-700 mb-6">
          {error?.status === 404
            ? "The page you're looking for doesn't exist."
            : "An unexpected error occurred."}
        </p>
        <p className="text-gray-500 mb-8">
          {error?.message || error?.statusText || "Something went wrong"}
        </p>
        <Link
          to="/"
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go Back Home
        </Link>
      </div>
    </div>
  );
};

export default Error;
