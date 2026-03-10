import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "./mapbox.css";
import { accessToken } from "./config";

mapboxgl.accessToken = accessToken;

const MapboxExample = () => {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-95.5, 30.5],
      zoom: 4,
    });
    mapRef.current = map;

    map.on("load", async () => {
      // Public GeoJSON with state FIPS ids (FL=12, TX=48)
      const statesRes = await fetch(
        "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"
      );
      const states = await statesRes.json();

      // Replace with values computed from your dataset pipeline
      const yoyByState = {
        "12": 4.8, // Florida YoY %
        "48": 2.3, // Texas YoY %
      };

      const focused = {
        type: "FeatureCollection",
        features: states.features
          .filter((f) => ["12", "48"].includes(String(f.id)))
          .map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              yoy: yoyByState[String(f.id)] ?? null,
            },
          })),
      };

      map.addSource("fl-tx-yoy", { type: "geojson", data: focused });

      map.addLayer({
        id: "fl-tx-fill",
        type: "fill",
        source: "fl-tx-yoy",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "yoy"], 0],
            -5, "#b2182b",
            0, "#f7f7f7",
            5, "#2166ac"
          ],
          "fill-opacity": 0.75,
        },
      });

      map.addLayer({
        id: "fl-tx-outline",
        type: "line",
        source: "fl-tx-yoy",
        paint: {
          "line-color": "#222",
          "line-width": 2,
        },
      });

      map.on("mousemove", "fl-tx-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        const name = f.properties?.name;
        const yoy = f.properties?.yoy;
        const html = `<strong>${name}</strong><br/>YoY: ${Number(yoy).toFixed(2)}%`;

        new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });

      map.on("mouseleave", "fl-tx-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => map.remove();
  }, []);

  return <div ref={mapContainer} className="map-container" />;
};

export default MapboxExample;