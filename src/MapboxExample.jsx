import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "./mapbox.css";
import { accessToken } from "./config";

mapboxgl.accessToken = accessToken;

const FRED_SERIES_BY_STATE_FIPS = {
  "12": "FLSTHPI",
  "48": "TXSTHPI",
};

const STATE_NAME_BY_FIPS = {
  "12": "FL",
  "48": "TX",
};

const STATES_SOURCE_ID = "fl-tx-state-yoy";
const COUNTIES_SOURCE_ID = "fl-tx-county-yoy";
const STATE_LAYER_IDS = ["state-fill-q0", "state-fill-q1", "state-fill-q2"];
const COUNTY_LAYER_ID = "county-fill-annual";
const COUNTY_OUTLINE_LAYER_ID = "county-outline";
const STATE_OUTLINE_LAYER_ID = "state-outline";
const COUNTIES_GEOJSON_URL =
  "https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json";

const emptyFeatureCollection = () => ({ type: "FeatureCollection", features: [] });

const parseFredCsvRows = (csvText) => {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  return lines.slice(1)
    .map((line) => {
      const [date, value] = line.split(",");
      if (!date || !value || value === ".") return null;
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) return null;

      return { date, value: numericValue };
    })
    .filter(Boolean);
};

const buildYoyFillColorExpression = (key) => [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", key], 0],
  -8, "#b2182b",
  0, "#f7f7f7",
  8, "#2166ac",
];

const toQuarterLabel = (dateStr) => {
  const [year, month] = dateStr.split("-");
  const monthNum = Number(month);
  const quarter = Math.floor((monthNum - 1) / 3) + 1;
  return `Q${quarter} ${year}`;
};

const fetchFredSeriesRows = async (seriesId) => {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`FRED fetch failed for ${seriesId}: ${res.status}`);
  }
  return parseFredCsvRows(await res.text());
};

const getQuarterlySnapshotAtOffset = (rows, offset) => {
  const currentIdx = rows.length - 1 - offset;
  const prevYearIdx = rows.length - 5 - offset;
  if (currentIdx < 0 || prevYearIdx < 0) return null;

  const current = rows[currentIdx];
  const previousYear = rows[prevYearIdx];
  if (!current || !previousYear || previousYear.value === 0) return null;

  return {
    yoy: ((current.value / previousYear.value) - 1) * 100,
    period: toQuarterLabel(current.date),
    value: current.value,
  };
};

const fetchCensusCountyHomeValues = async (year, stateFips) => {
  const url = `https://api.census.gov/data/${year}/acs/acs5?get=NAME,B25077_001E&for=county:*&in=state:${stateFips}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Census fetch failed for ${year} state ${stateFips}: ${res.status}`);
  }

  const data = await res.json();
  const rows = Array.isArray(data) ? data.slice(1) : [];

  return rows
    .map((row) => {
      const name = row?.[0];
      const value = Number(row?.[1]);
      const state = row?.[2];
      const county = row?.[3];

      if (!state || !county || !Number.isFinite(value) || value <= 0) return null;

      return {
        fips: `${state}${county}`,
        name,
        value,
      };
    })
    .filter(Boolean);
};

const MapboxExample = () => {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);
  const countyDataLoadedRef = useRef(false);
  const countyDataLoadingRef = useRef(false);

  const [layerToggles, setLayerToggles] = useState({
    stateQ0: true,
    stateQ1: false,
    stateQ2: false,
    countyAnnual: false,
  });
  const [countyLoadState, setCountyLoadState] = useState({
    loading: false,
    error: "",
    loaded: false,
    unavailableCount: 0,
    availableCount: 0,
    totalCount: 0,
    year: "",
  });

  const setMapLayerVisibility = (map, layerId, isVisible) => {
    if (!map || !map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", isVisible ? "visible" : "none");
  };

  useEffect(() => {
    let isUnmounted = false;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-95.5, 30.5],
      zoom: 4,
    });
    mapRef.current = map;

    map.on("load", async () => {
      if (isUnmounted) return;

      // Public GeoJSON with state FIPS ids (FL=12, TX=48)
      const statesRes = await fetch(
        "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"
      );
      const states = await statesRes.json();

      const fallbackByState = {
        "12": [
          { yoy: 4.8, period: "(fallback q0)", value: null },
          { yoy: 4.6, period: "(fallback q1)", value: null },
          { yoy: 4.2, period: "(fallback q2)", value: null },
        ],
        "48": [
          { yoy: 2.3, period: "(fallback q0)", value: null },
          { yoy: 2.1, period: "(fallback q1)", value: null },
          { yoy: 1.9, period: "(fallback q2)", value: null },
        ],
      };

      const fredResults = await Promise.allSettled(
        Object.entries(FRED_SERIES_BY_STATE_FIPS).map(async ([fips, seriesId]) => {
          const rows = await fetchFredSeriesRows(seriesId);
          const snapshots = [0, 1, 2].map((offset) => getQuarterlySnapshotAtOffset(rows, offset));

          if (snapshots.some((snapshot) => snapshot === null)) {
            throw new Error(`Not enough quarterly rows for ${seriesId}`);
          }

          return [fips, { snapshots, seriesId }];
        })
      );

      const dataByState = Object.fromEntries(
        fredResults.map((result, idx) => {
          const fips = Object.keys(FRED_SERIES_BY_STATE_FIPS)[idx];
          const seriesId = FRED_SERIES_BY_STATE_FIPS[fips];

          if (result.status === "fulfilled") {
            return [fips, result.value[1]];
          }

          console.warn(`Using fallback for ${seriesId}`, result.reason);
          return [fips, { snapshots: fallbackByState[fips], seriesId }];
        })
      );

      const focused = {
        type: "FeatureCollection",
        features: states.features
          .filter((f) => ["12", "48"].includes(String(f.id)))
          .map((f) => ({
            id: f.id,
            ...f,
            properties: {
              ...f.properties,
              yoy_q0: dataByState[String(f.id)]?.snapshots?.[0]?.yoy ?? null,
              yoy_q1: dataByState[String(f.id)]?.snapshots?.[1]?.yoy ?? null,
              yoy_q2: dataByState[String(f.id)]?.snapshots?.[2]?.yoy ?? null,
              period_q0: dataByState[String(f.id)]?.snapshots?.[0]?.period ?? "N/A",
              period_q1: dataByState[String(f.id)]?.snapshots?.[1]?.period ?? "N/A",
              period_q2: dataByState[String(f.id)]?.snapshots?.[2]?.period ?? "N/A",
              hpi_q0: dataByState[String(f.id)]?.snapshots?.[0]?.value ?? null,
              hpi_q1: dataByState[String(f.id)]?.snapshots?.[1]?.value ?? null,
              hpi_q2: dataByState[String(f.id)]?.snapshots?.[2]?.value ?? null,
              seriesId: dataByState[String(f.id)]?.seriesId ?? null,
            },
          })),
      };

      map.addSource(STATES_SOURCE_ID, { type: "geojson", data: focused });
      map.addSource(COUNTIES_SOURCE_ID, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });

      const stateLayerConfigs = [
        { id: STATE_LAYER_IDS[0], key: "yoy_q0", periodKey: "period_q0", hpiKey: "hpi_q0" },
        { id: STATE_LAYER_IDS[1], key: "yoy_q1", periodKey: "period_q1", hpiKey: "hpi_q1" },
        { id: STATE_LAYER_IDS[2], key: "yoy_q2", periodKey: "period_q2", hpiKey: "hpi_q2" },
      ];

      stateLayerConfigs.forEach(({ id, key }, idx) => {
        map.addLayer({
          id,
          type: "fill",
          source: STATES_SOURCE_ID,
          layout: {
            visibility: idx === 0 ? "visible" : "none",
          },
          paint: {
            "fill-color": buildYoyFillColorExpression(key),
            "fill-opacity": 0.68,
          },
        });
      });

      map.addLayer({
        id: STATE_OUTLINE_LAYER_ID,
        type: "line",
        source: STATES_SOURCE_ID,
        paint: {
          "line-color": "#222",
          "line-width": 2,
        },
      });

      map.addLayer({
        id: COUNTY_LAYER_ID,
        type: "fill",
        source: COUNTIES_SOURCE_ID,
        layout: {
          visibility: "none",
        },
        paint: {
          "fill-color": buildYoyFillColorExpression("county_yoy"),
          "fill-opacity": 0.58,
        },
      });

      map.addLayer({
        id: COUNTY_OUTLINE_LAYER_ID,
        type: "line",
        source: COUNTIES_SOURCE_ID,
        layout: {
          visibility: "none",
        },
        paint: {
          "line-color": "#6b7280",
          "line-width": 0.5,
        },
      });

      const hoverPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      const formatNumber = (value, suffix = "") => {
        const asNumber = Number(value);
        if (!Number.isFinite(asNumber)) return "N/A";
        return `${asNumber.toFixed(2)}${suffix}`;
      };

      const onStateHover = (periodKey, yoyKey, hpiKey) => (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";

        const name = f.properties?.name ?? "State";
        const period = f.properties?.[periodKey] ?? "N/A";
        const yoyText = formatNumber(f.properties?.[yoyKey], "%");
        const hpiText = formatNumber(f.properties?.[hpiKey]);

        const html = `
          <strong>${name}</strong><br/>
          Period: ${period}<br/>
          YoY: ${yoyText}<br/>
          HPI: ${hpiText}
        `;

        hoverPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      };

      stateLayerConfigs.forEach(({ id, periodKey, key, hpiKey }) => {
        map.on("mousemove", id, onStateHover(periodKey, key, hpiKey));
        map.on("mouseleave", id, () => {
          map.getCanvas().style.cursor = "";
          hoverPopup.remove();
        });
      });

      map.on("mousemove", COUNTY_LAYER_ID, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";

        const countyName = f.properties?.NAME ?? "County";
        const countyFips = String(f.id ?? "");
        const stateFips = countyFips.slice(0, 2);
        const stateCode = STATE_NAME_BY_FIPS[stateFips] ?? "";
        const label = f.properties?.county_period ?? "N/A";
        const yoyText = formatNumber(f.properties?.county_yoy, "%");
        const hpiText = Number.isFinite(Number(f.properties?.county_hpi))
          ? `$${Math.round(Number(f.properties.county_hpi)).toLocaleString()}`
          : "N/A";
        const html = `
          <strong>${countyName}${stateCode ? `, ${stateCode}` : ""}</strong><br/>
          Year: ${label}<br/>
          YoY: ${yoyText}<br/>
          Median Home Value: ${hpiText}<br/>
          Source: US Census ACS 5-year
        `;

        hoverPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });

      map.on("mouseleave", COUNTY_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
        hoverPopup.remove();
      });
    });

    return () => {
      isUnmounted = true;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    setMapLayerVisibility(map, STATE_LAYER_IDS[0], layerToggles.stateQ0);
    setMapLayerVisibility(map, STATE_LAYER_IDS[1], layerToggles.stateQ1);
    setMapLayerVisibility(map, STATE_LAYER_IDS[2], layerToggles.stateQ2);
    setMapLayerVisibility(map, COUNTY_LAYER_ID, layerToggles.countyAnnual);
    setMapLayerVisibility(map, COUNTY_OUTLINE_LAYER_ID, layerToggles.countyAnnual);
  }, [layerToggles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layerToggles.countyAnnual) return;
    if (countyDataLoadedRef.current || countyDataLoadingRef.current) return;

    const loadCountyData = async () => {
      countyDataLoadingRef.current = true;
      setCountyLoadState((prev) => ({ ...prev, loading: true, error: "" }));

      try {
        const countiesRes = await fetch(COUNTIES_GEOJSON_URL);
        if (!countiesRes.ok) {
          throw new Error(`County GeoJSON fetch failed: ${countiesRes.status}`);
        }

        const counties = await countiesRes.json();
        const countyFeatures = (counties.features ?? []).filter((feature) => {
          const fips = String(feature.id ?? "");
          return fips.startsWith("12") || fips.startsWith("48");
        });

        // Census ACS county home values have broader FL/TX county coverage than FRED county HPI series.
        const latestYear = 2023;
        const prevYear = 2022;
        const [flLatest, txLatest, flPrev, txPrev] = await Promise.all([
          fetchCensusCountyHomeValues(latestYear, "12"),
          fetchCensusCountyHomeValues(latestYear, "48"),
          fetchCensusCountyHomeValues(prevYear, "12"),
          fetchCensusCountyHomeValues(prevYear, "48"),
        ]);

        const latestMap = new Map([...flLatest, ...txLatest].map((row) => [row.fips, row]));
        const prevMap = new Map([...flPrev, ...txPrev].map((row) => [row.fips, row]));

        let unavailableCount = 0;
        let availableCount = 0;

        const enrichedFeatures = countyFeatures
          .map((feature) => {
            const countyFips = String(feature.id ?? "");
            const latest = latestMap.get(countyFips);
            const prev = prevMap.get(countyFips);

            if (!latest || !prev || prev.value === 0) {
              unavailableCount += 1;
              return null;
            }

            const yoy = ((latest.value / prev.value) - 1) * 100;
            availableCount += 1;

            return {
              ...feature,
              properties: {
                ...(feature.properties ?? {}),
                county_yoy: yoy,
                county_period: String(latestYear),
                county_hpi: latest.value,
              },
            };
          })
          .filter(Boolean);

        const source = map.getSource(COUNTIES_SOURCE_ID);
        if (source) {
          source.setData({
            type: "FeatureCollection",
            features: enrichedFeatures,
          });
        }

        countyDataLoadedRef.current = true;
        setCountyLoadState({
          loading: false,
          error: "",
          loaded: true,
          unavailableCount,
          availableCount,
          totalCount: countyFeatures.length,
          year: String(latestYear),
        });
      } catch (error) {
        setCountyLoadState({
          loading: false,
          error: error?.message ?? "Failed to load county data",
          loaded: false,
          unavailableCount: 0,
          availableCount: 0,
          totalCount: 0,
          year: "",
        });
      } finally {
        countyDataLoadingRef.current = false;
      }
    };

    loadCountyData();
  }, [layerToggles.countyAnnual]);

  const onToggleChange = (key) => {
    setLayerToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map-container" />

      <div className="layer-controls">
        <h3>Layer Toggles</h3>
        <label>
          <input
            type="checkbox"
            checked={layerToggles.stateQ0}
            onChange={() => onToggleChange("stateQ0")}
          />
          State YoY (Latest quarter)
        </label>
        <label>
          <input
            type="checkbox"
            checked={layerToggles.stateQ1}
            onChange={() => onToggleChange("stateQ1")}
          />
          State YoY (Previous quarter)
        </label>
        <label>
          <input
            type="checkbox"
            checked={layerToggles.stateQ2}
            onChange={() => onToggleChange("stateQ2")}
          />
          State YoY (2 quarters back)
        </label>
        <label>
          <input
            type="checkbox"
            checked={layerToggles.countyAnnual}
            onChange={() => onToggleChange("countyAnnual")}
          />
          County YoY (Annual, Census)
        </label>

        {countyLoadState.loading && (
          <p className="status status-loading">Loading county annual data (Census)...</p>
        )}
        {countyLoadState.error && (
          <p className="status status-error">County data error: {countyLoadState.error}</p>
        )}
        {countyLoadState.loaded && countyLoadState.unavailableCount > 0 && (
          <p className="status status-warn">
            County data unavailable for {countyLoadState.unavailableCount} counties.
          </p>
        )}
        {countyLoadState.loaded && (
          <p className="status status-loading">
            Showing {countyLoadState.availableCount} of {countyLoadState.totalCount} FL/TX counties
            with {countyLoadState.year} annual data.
          </p>
        )}
      </div>
    </div>
  );
};

export default MapboxExample;