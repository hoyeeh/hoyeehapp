import { useEffect } from "react";

const TVReceiver = () => {
  useEffect(() => {
    // Redirect to the static TV receiver HTML
    window.location.href = "/tv-receiver/index.html";
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center text-white">
        <p className="text-xl text-orange-500 font-bold">HOYEEH</p>
        <p className="mt-4">Loading TV Receiver...</p>
      </div>
    </div>
  );
};

export default TVReceiver;
