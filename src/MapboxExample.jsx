import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "./mapbox.css";

// import "mapbox-gl/dist/mapbox-gl.css";

import { accessToken } from "./config";

mapboxgl.accessToken = accessToken;

const MapboxExample = () => {
  const mapRef = useRef();
  const mapContainer = useRef(null);

  useEffect(() => {
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.5, 40], // starting position [lng, lat]
      zoom: 9, // starting zoom
    });
  });

  return <div ref={mapContainer} className="map-container" />;
};

export default MapboxExample;
