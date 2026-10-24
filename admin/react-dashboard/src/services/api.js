
import axios from "axios";

const api = axios.create({
  baseURL: "https://parkmind-p9us.onrender.com",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
