import React, { useEffect, useState } from "react";

const GoogleLogin = () => {
  const [authUrl, setAuthUrl] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/google`)
      .then((res) => res.json())
      .then((data) => setAuthUrl(data.authUrl))
      .catch((error) => console.error("Error fetching auth URL:", error));
  }, []);
  
  return (
    <div>
      <h2>Login with Google</h2>
      <a href={authUrl}>
        <button>Sign in with Google</button>
      </a>
    </div>
  );
};

export default GoogleLogin;
