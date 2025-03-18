import React, { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import "@arcgis/core/assets/esri/themes/light/main.css";
import { performSearch } from "../utils/searchUtil";
import axios from "axios";
import Papa from "papaparse";

// CSV fetch functions using PapaParse
async function getSheetData() {
  // Poverty CSV
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTuVsdCcxjO9B4eUn8RornEhC061GRbybSbNlgCEXNuBNTPhPyybN5Yn00kfhmmTAeCmtIZ-hsNrxH4/pub?output=csv";
  try {
    const response = await axios.get(sheetUrl);
    const parsed = Papa.parse(response.data, { header: true, skipEmptyLines: true });
    console.log("Poverty data loaded:", parsed.data);
    return parsed.data;
  } catch (error) {
    console.error("Error fetching poverty CSV data:", error);
    return [];
  }
}

async function getChurchData() {
  // Church CSV
  const churchCsvUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQefnw4KOV5sBhvRHI-ptUNjDlBxWSE678iwq8mxuGGTbf2Odgc-w6x_H2UPs1g3cGf9DM9U4rdYNoA/pub?output=csv";
  try {
    const response = await axios.get(churchCsvUrl);
    const parsed = Papa.parse(response.data, { header: true, skipEmptyLines: true });
    console.log("Church data loaded:", parsed.data);
    return parsed.data;
  } catch (error) {
    console.error("Error fetching Church CSV data:", error);
    return [];
  }
}

// SearchBox component
const SearchBox = ({
  searchField,
  setSearchField,
  searchValue,
  setSearchValue,
  onSearch,
  selectedLayer,
  searchStatus,
}) => (
  <div style={{ position: "absolute", bottom: "100px", left: "20px", zIndex: 1000 }}>
    <form
      onSubmit={onSearch}
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
        padding: "20px",
        borderRadius: "10px",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
        width: "250px",
      }}
    >
      <label style={{ marginBottom: "10px", fontWeight: "bold" }}>
        Search By:
        <select
          value={searchField}
          onChange={(e) => setSearchField(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            margin: "10px 0",
            borderRadius: "5px",
            border: "1px solid #ccc",
          }}
        >
          <option value="">-- Please select an option --</option>
          {selectedLayer === "censusTracts" ? (
            <>
              <option value="P1_001N">Total Population</option>
              <option value="DP03_0004PE">Employment Rate</option>
              <option value="DP02_0001E">Total Households</option>
              <option value="S1901_C01_012E">Median Household Income</option>
            </>
          ) : (
            <>
              <option value="ZIP_CODE">Zip Code</option>
              <option value="PO_NAME">Post Office Name</option>
            </>
          )}
        </select>
      </label>

      <label style={{ marginBottom: "10px", fontWeight: "bold" }}>
        Value:
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Enter search value"
          style={{
            width: "100%",
            padding: "10px",
            margin: "10px 0",
            borderRadius: "5px",
            border: "1px solid #ccc",
          }}
        />
      </label>

      <button
        type="submit"
        style={{
          padding: "10px",
          backgroundColor: "#007BFF",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Search
      </button>

      {searchStatus && (
        <div style={{ marginTop: "10px", color: "red", fontWeight: "bold" }}>
          {searchStatus}
        </div>
      )}
    </form>
  </div>
);

const ArcGISMap = () => {
  const viewDivRef = useRef(null);
  const [map, setMap] = useState(null);
  const [view, setView] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState("censusTracts"); // "censusTracts" or "zipCodes"
  const [searchField, setSearchField] = useState("unselected");
  const [searchValue, setSearchValue] = useState("");
  const geoJsonLayerRef = useRef(null);
  const [layerLoaded, setLayerLoaded] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [povertyData, setPovertyData] = useState([]);
  const [churchData, setChurchData] = useState([]);

  // Fetch CSV data on mount
  useEffect(() => {
    getSheetData().then(setPovertyData).catch(console.error);
    getChurchData().then(setChurchData).catch(console.error);
  }, []);

  // Create the map and view on mount
  useEffect(() => {
    const newMap = new Map({ basemap: "topo-vector" });
    const mapView = new MapView({
      container: viewDivRef.current,
      map: newMap,
      zoom: 10,
      center: [-122.0081095, 37.5371513],
      popup: { autoOpenEnabled: true },
    });

    setMap(newMap);
    setView(mapView);

    return () => {
      mapView?.destroy();
    };
  }, []);

  // Load the GeoJSON layer and define the popup template based on selectedLayer
  useEffect(() => {
    if (!map || !view) return;
    map.removeAll();

    // Determine GeoJSON URL based on selected layer
    const geojsonUrl =
      selectedLayer === "censusTracts"
        ? `${process.env.PUBLIC_URL}/bay_area_tracts_geometry.geojson`
        : `${process.env.PUBLIC_URL}/BayAreaZipCodes.geojson`;

    // Define popup template based on layer type
    const popupTemplate =
      selectedLayer === "censusTracts"
        ? {
            title: "{NAMELSAD}",
            content: (graphic) => {
              // Always use a fallback object for attributes
              const attrs = graphic.attributes || {};
              // US Census API fields
              const totalPopulation = attrs.P1_001N || "N/A";
              const employmentRate = attrs.DP03_0004PE || "N/A";
              const totalHouseholds = attrs.DP02_0001E || "N/A";
              const medianHouseholdIncome = attrs.S1901_C01_012E || "N/A";
              // Additional CSV data from poverty CSV
              // Using the census tract identifier from attribute "NAME"
              const tractId = attrs.NAME || "";
              const record = povertyData.find(
                (row) =>
                  row["Census Tract"] &&
                  row["Census Tract"].trim() === tractId.trim()
              ) || {};
              const adoptionStatus = record["Adoption Status"] || "N/A";
              const adoptedBy = record["Adopted by"] || "N/A";
              const csvChurches = record["Churches"] || "N/A";
              const nonProfits = record["Non-Profits"] || "N/A";
              const localBusiness = record["Local Business"] || "N/A";

              return `
                <b>Total Population:</b> ${totalPopulation}<br>
                <b>Employment Rate:</b> ${employmentRate}%<br>
                <b>Total Households:</b> ${totalHouseholds}<br>
                <b>Median Household Income:</b> ${medianHouseholdIncome}<br>
                <b>Adoption Status:</b> ${adoptionStatus}<br>
                <b>Adopted by:</b> ${adoptedBy}<br>
                <b>Churches:</b> ${csvChurches}<br>
                <b>Non-Profits:</b> ${nonProfits}<br>
                <b>Local Business:</b> ${localBusiness}
              `;
            },
          }
        : {
            title: "Zip Code: {ZIP_CODE}",
            content: (graphic) => {
              const attrs = graphic.attributes || {};
              // US Census API fields
              const totalPopulation = attrs.P1_001N || "N/A";
              const employmentRate = attrs.DP03_0004PE || "N/A";
              const totalHouseholds = attrs.DP02_0001E || "N/A";
              const medianHouseholdIncome = attrs.S1901_C01_012E || "N/A";
              // Additional CSV data from church CSV
              const zip = attrs.ZIP_CODE || "";
              const churchRecord = churchData.find(
                (row) =>
                  row["Zip Code"] &&
                  row["Zip Code"].trim() === zip.trim()
              ) || {};
              const churchName = churchRecord["Name"] || "N/A";

              return `
                <b>Total Population:</b> ${totalPopulation}<br>
                <b>Employment Rate:</b> ${employmentRate}%<br>
                <b>Total Households:</b> ${totalHouseholds}<br>
                <b>Median Household Income:</b> ${medianHouseholdIncome}<br>
                <b>Churches:</b> ${churchName}
              `;
            },
          };

    const geoJsonLayer = new GeoJSONLayer({
      url: geojsonUrl,
      outFields: ["*"],
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color:
            selectedLayer === "censusTracts"
              ? "rgba(255, 0, 0, 0.3)"
              : "rgba(0, 255, 0, 0.3)",
          outline: { color: "black", width: 1 },
        },
      },
      popupTemplate,
    });

    geoJsonLayer
      .when(() => {
        geoJsonLayerRef.current = geoJsonLayer;
        setLayerLoaded(true);
        view.goTo(geoJsonLayer.fullExtent).catch(console.warn);
      })
      .catch((error) => console.error("Error loading GeoJSON layer:", error));

    map.add(geoJsonLayer);

    // Use hitTest to open the popup on click
    view.on("click", (event) => {
      view.hitTest(event).then((response) => {
        console.log("hitTest response:", response.results);
        const result = response.results.find(
          (res) => res.graphic?.layer === geoJsonLayer
        );
        if (result) {
          const g = result.graphic;
          const template = g.popupTemplate || { title: "", content: "No popup template defined." };
          const content = typeof template.content === "function" ? template.content(g) : template.content;
          view.popup.title = template.title || "";
          view.popup.content = content;
          view.popup.location = event.mapPoint;
          view.popup.visible = true;
        } else {
          console.warn("No feature from the GeoJSON layer was found at this click.");
        }
      });
    });
  }, [selectedLayer, map, view, povertyData, churchData]);

  // Handle search functionality using performSearch utility
  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchStatus("");
    if (!geoJsonLayerRef.current) {
      setSearchStatus("Layer is not ready. Please wait and try again.");
      return;
    }
    if (!layerLoaded) {
      setSearchStatus("Layer is still loading. Please wait and try again.");
      return;
    }
    const result = await performSearch({
      view,
      geoJsonLayer: geoJsonLayerRef.current,
      searchField,
      searchValue,
    });
    if (!result.success) {
      console.error("Search error:", result.message);
      setSearchStatus(result.message);
    } else {
      console.log("Search completed successfully.");
    }
  };

  // Toggle between census tract view and zip code view
  const toggleLayer = () => {
    setSelectedLayer((prev) =>
      prev === "censusTracts" ? "zipCodes" : "censusTracts"
    );
  };

  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw" }}>
      <div ref={viewDivRef} style={{ height: "100%", width: "100%" }}></div>
      <SearchBox
        searchField={searchField}
        setSearchField={setSearchField}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        onSearch={handleSearch}
        selectedLayer={selectedLayer}
        searchStatus={searchStatus}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "20px",
          zIndex: 1000,
        }}
      >
        <button
          onClick={toggleLayer}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007BFF",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          {selectedLayer === "censusTracts"
            ? "Switch to Zip Code View"
            : "Switch to Census Tract View"}
        </button>
      </div>
    </div>
  );
};

export default ArcGISMap;
