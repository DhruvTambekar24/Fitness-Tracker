import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const Dashboard = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("user");

  useEffect(() => {
    if (!userId) {
      console.error("User ID not found in URL.");
      setError("User ID is missing from the URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`${import.meta.env.VITE_BACKEND_URL}/fetch-data?user=${userId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setUserData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching fitness data:", error);
        setError("Failed to load fitness data. Please try again.");
        setLoading(false);
      });
  }, [userId]);

  return (
    <div>
      <h2>Dashboard</h2>

      {loading && <p>Loading fitness data...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {userData && (
        <div>
          <h3>Welcome, {userData.displayName}</h3>
          <img src={userData.profilePhotoUrl} alt="Profile" width="100" />
          <h4>Your Fitness Data:</h4>
          <ul>
            {userData?.formattedData?.length ? (
              userData.formattedData.map((data, index) => (
                <li key={index}>
                  {data.date}: Steps - {data.step_count}, Heart Rate - {data.heart_rate} bpm
                </li>
              ))
            ) : (
              <p>No fitness data available.</p>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
// import React, { useEffect, useState } from "react";

// const Dashboard = () => {
//   const [user, setUser] = useState(null);

//   useEffect(() => {
//     fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/user`, {
//       credentials: "include", // Important: Ensures cookies (session) are sent
//     })
//       .then((res) => res.json())
//       .then((data) => setUser(data))
//       .catch((error) => console.error("Error fetching user:", error));
//   }, []);

//   return (
//     <div>
//       <h2>Dashboard</h2>
//       {user ? (
//         <div>
//           <p>Welcome, {user.displayName}!</p>
//           <img src={user.profilePhotoUrl} alt="Profile" />
//           <p>User ID: {user.userID}</p>
//         </div>
//       ) : (
//         <p>Loading user data...</p>
//       )}
//     </div>
//   );
// };

// export default Dashboard;

// import { useEffect, useState } from "react";
// import { useSearchParams } from "react-router-dom";

// const Dashboard = () => {
//   const [userData, setUserData] = useState(null);
//   const [searchParams] = useSearchParams();
//   const userId = searchParams.get("user"); // 🔥 Get user ID from URL

//   useEffect(() => {
//     if (userId) {
//       fetch(`${import.meta.env.VITE_BACKEND_URL}/fetch-data?user=${userId}`, { credentials: "include" })
//         .then((res) => res.json())
//         .then((data) => setUserData(data))
//         .catch((error) => console.error("Error fetching fitness data:", error));
//     }
//   }, [userId]);

//   return (
//     <div>
//       <h2>Dashboard</h2>
//       {userData ? (
//         <div>
//           <h3>Welcome, {userData.displayName}</h3>
//           <img src={userData.profilePhotoUrl} alt="Profile" width="100" />
//           <h4>Your Fitness Data:</h4>
//           <ul>
//             {userData.formattedData.map((data, index) => (
//               <li key={index}>
//                 {data.date}: Steps - {data.step_count}, Heart Rate - {data.heart_rate} bpm
//               </li>
//             ))}
//           </ul>
//         </div>
//       ) : (
//         <p>Loading...</p>
//       )}
//     </div>
//   );
// };

// export default Dashboard;

