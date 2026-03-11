import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "mapbox-gl/dist/mapbox-gl.css";
import "./index.css";
import MapboxExample from "./MapboxExample.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MapboxExample />
  </StrictMode>
);
