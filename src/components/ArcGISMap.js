import React, { useEffect, useRef, useState, useCallback } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import "@arcgis/core/assets/esri/themes/light/main.css";
import { performSearch } from "../utils/searchUtil";
import axios from "axios";
import Papa from "papaparse";
import { fetchCensusTractsData, fetchZipcodeData, injectCensusDataIntoLayer } from "../utils/censusDataUtils";
import SearchComponent from "./SearchComponent";
import PolygonSelection from "./PolygonSelection";
import { 
  processAdoptionStatus, 
  createAdoptionStatusRenderer,
  createAdoptionStatusPopupTemplate 
} from "../utils/adoptionStatusUtils";

// CSV fetch functions using PapaParse
async function getSheetData() {
  // Poverty CSV remains unchanged
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2x0Lik-Flp1e9x-BL2Lrz-bt1lBnmfjyq-xaJre8U3nb-RmRRHHqZ5XyMczrfaA-UJDEmsMhBAJ_7/pub?output=csv";
  try {
    const response = await axios.get(sheetUrl);
    const parsed = Papa.parse(response.data, { 
      header: true, 
      skipEmptyLines: true,
      transformHeader: (header) => header.trim() 
    });
    
    console.log("Poverty data loaded:", parsed.data.length, "rows");
    console.log("CSV Headers:", parsed.meta.fields);
    
    // Check if we have the required columns
    const hasCensusTract = parsed.meta.fields.includes("Census Tract");
    const hasAdoptionStatus = parsed.meta.fields.includes("Adoption Status");
    
    console.log("Has Census Tract column:", hasCensusTract);
    console.log("Has Adoption Status column:", hasAdoptionStatus);
    
    return parsed.data;
  } catch (error) {
    console.error("Error fetching poverty CSV data:", error);
    return [];
  }
}

async function getChurchData() {
  // Updated Church CSV with ?output=csv link
  const churchCsvUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQefnw4KOV5sBhvRHI-ptUNjDlBxWSE678iwq8mxuGGTbf2Odgc-w6x_H2UPs1g3cGf9DM9U4rdYNoA/pub?output=csv";
  try {
    const response = await axios.get(churchCsvUrl);
    const parsed = Papa.parse(response.data, { 
      header: true, 
      skipEmptyLines: true,
      transformHeader: (header) => header.trim() 
    });
    
    // Log the headers to verify we're getting the right columns
    console.log("Church data headers:", parsed.meta.fields);
    
    // Create a map of zip codes to arrays of church names for faster lookups
    const churchesByZip = {};
    parsed.data.forEach(church => {
      const zipCode = church["Zip Code"];
      const name = church["Name"];
      
      if (!zipCode || !name) return;
      
      // Convert any zip code to string and normalize it
      const zipStr = zipCode.toString().trim();
      
      if (!churchesByZip[zipStr]) {
        churchesByZip[zipStr] = [];
      }
      
      churchesByZip[zipStr].push(name);
    });
    
    console.log("Church data organized by ZIP code. Available ZIPs:", Object.keys(churchesByZip));
    
    // Return both the raw data and the lookup map
    return {
      rawData: parsed.data,
      churchesByZip: churchesByZip
    };
  } catch (error) {
    console.error("Error fetching Church CSV data:", error);
    return {
      rawData: [],
      churchesByZip: {}
    };
  }
}

const ArcGISMap = () => {
  const viewDivRef = useRef(null);
  const [map, setMap] = useState(null);
  const [view, setView] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState("censusTracts"); // "censusTracts" or "zipCodes"
  const [searchField, setSearchField] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const geoJsonLayerRef = useRef(null);
  const [layerLoaded, setLayerLoaded] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [povertyData, setPovertyData] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [churchData, setChurchData] = useState([]);
  const [churchesByZip, setChurchesByZip] = useState({});
  // New state for census data
  const [censusTractData, setCensusTractData] = useState({});
  const [zipCodeData, setZipCodeData] = useState({});
  // New state for adoption status map
  const [adoptionStatusMap, setAdoptionStatusMap] = useState({});

  // Fetch CSV data on mount
  useEffect(() => {
    getSheetData()
      .then(data => {
        setPovertyData(data);
        // Process the adoption status from the CSV data
        const statusMap = processAdoptionStatus(data);
        setAdoptionStatusMap(statusMap);
        console.log("Adoption status processed from CSV data");
      })
      .catch(console.error);
    
    getChurchData().then(data => {
      setChurchData(data.rawData);
      setChurchesByZip(data.churchesByZip);
      console.log("Church data loaded:", data.rawData.length, "records");
    }).catch(console.error);

    // Fetch census data
    const apiKey = process.env.REACT_APP_CENSUS_API_KEY;
    if (apiKey) {
      // Fetch census tract data
      fetchCensusTractsData(apiKey)
        .then(data => {
          setCensusTractData(data);
          console.log("Census tract data loaded:", Object.keys(data).length, "records");
        })
        .catch(console.error);
      
      // Fetch ZIP code data
      fetchZipcodeData(apiKey)
        .then(data => {
          setZipCodeData(data);
          console.log("ZIP code data loaded:", Object.keys(data).length, "records");
        })
        .catch(console.error);
    } else {
      console.warn("Census API key not found. Set REACT_APP_CENSUS_API_KEY in your environment.");
    }
  }, []);

  // Create the map and view on mount
  useEffect(() => {
    const newMap = new Map({ basemap: "topo-vector" });
    const mapView = new MapView({
      container: viewDivRef.current,
      map: newMap,
      zoom: 10,
      center: [-122.0081095, 37.5371513],
      popup: { 
        autoOpenEnabled: true,
        dockEnabled: false,
        dockOptions: {
          buttonEnabled: false,
          breakpoint: false,
          position: "top-right"
        }
      },
    });

    // Once the view is ready, set it up completely
    mapView.when(() => {
      console.log("Map view initialized");
      setMap(newMap);
      setView(mapView);
    });

    return () => {
      mapView?.destroy();
    };
  }, []);

  // Function to generate content for census tract popups - using useCallback to avoid dependency issues
  const generateCensusTractContent = useCallback((graphic) => {
    const attrs = graphic.attributes || {};
    
    // US Census API fields
    const totalPopulation = attrs.P1_001N || "N/A";
    const employmentRate = attrs.DP03_0004PE || "N/A";
    const totalHouseholds = attrs.DP02_0001E || "N/A";
    const medianHouseholdIncome = attrs.S1901_C01_012E || "N/A";
    
    // We'll add adoption status in the layer's popup template content function
    return `
      <div style="text-align: left;">
        <b>Census Tract:</b> ${attrs.NAMELSAD || "Unknown"}<br>
        <b>Total Population:</b> ${totalPopulation}<br>
        <b>Employment Rate:</b> ${employmentRate}%<br>
        <b>Total Households:</b> ${totalHouseholds}<br>
        <b>Median Household Income:</b> $${medianHouseholdIncome}<br>
        <b>Adoption Status:</b> <span id="adoption-status-placeholder"></span><br>
        <b>Adopted by:</b> <span id="adopted-by-placeholder"></span><br>
        <b>Churches:</b> <span id="churches-placeholder"></span><br>
        <b>Non-Profits:</b> <span id="nonprofits-placeholder"></span><br>
        <b>Local Business:</b> <span id="business-placeholder"></span>
      </div>
    `;
  }, []);

  // Function to generate content for zip code popups - using useCallback to avoid dependency issues
  const generateZipCodeContent = useCallback((feature) => {
    // Get all attributes from the feature
    const attrs = feature.graphic ? feature.graphic.attributes : feature.attributes || {};
    
    // Get attributes for the display
    const totalPopulation = attrs.P1_001N || "N/A";
    const employmentRate = attrs.DP03_0004PE || "N/A";
    const totalHouseholds = attrs.DP02_0001E || "N/A";
    const medianHouseholdIncome = attrs.S1901_C01_012E || "N/A";
    
    // Try different ways to get the ZIP code
    let zipCode = null;
    if (attrs.ZIP_CODE !== undefined && attrs.ZIP_CODE !== null) {
      zipCode = attrs.ZIP_CODE.toString().trim();
    } else if (attrs.ZIP !== undefined && attrs.ZIP !== null) {
      zipCode = attrs.ZIP.toString().trim();
    } else if (attrs.ZIPCODE !== undefined && attrs.ZIPCODE !== null) {
      zipCode = attrs.ZIPCODE.toString().trim();
    } else {
      // Try to find any attribute that looks like a ZIP code
      for (const key in attrs) {
        if (key.toUpperCase().includes('ZIP') && attrs[key] !== null) {
          zipCode = attrs[key].toString().trim();
          console.log(`Found ZIP in alternate field: ${key}=${zipCode}`);
          break;
        }
      }
    }
    
    // Get church names for this ZIP from our precomputed lookup
    let churchNames = "No churches found";
    if (zipCode && churchesByZip[zipCode] && churchesByZip[zipCode].length > 0) {
      churchNames = churchesByZip[zipCode].join(", ");
      console.log(`Found ${churchesByZip[zipCode].length} churches for ZIP ${zipCode}`);
    } else {
      console.log(`No churches found for ZIP ${zipCode}`);
    }

    return `
      <div style="text-align: left;">
        <h3>ZIP Code: ${zipCode || "N/A"}</h3>
        <b>Total Population:</b> ${totalPopulation}<br>
        <b>Employment Rate:</b> ${employmentRate}%<br>
        <b>Total Households:</b> ${totalHouseholds}<br>
        <b>Median Household Income:</b> $${medianHouseholdIncome}<br>
        <b>Adoption Status:</b> <span id="adoption-status-placeholder"></span><br>
        <b>Churches:</b> ${churchNames}
      </div>
    `;
  }, [churchesByZip]);

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
            title: "{NAMELSAD}", // This displays the census tract identifier
            content: generateCensusTractContent
          }
        : {
            title: "Zip Code: {ZIP_CODE}",
            content: generateZipCodeContent
          };

    // Create the GeoJSON layer with a basic renderer
    // Initially use a simple renderer, we'll update it after the layer loads
    const geoJsonLayer = new GeoJSONLayer({
      url: geojsonUrl,
      outFields: ["*"],
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: "rgba(128, 128, 128, 0.3)", // Gray for default
          outline: {
            color: "black",
            width: 1,
          },
        }
      },
      popupTemplate,
    });

    // When layer loads, enrich it with census data and handle the view
    geoJsonLayer.when(() => {
      geoJsonLayerRef.current = geoJsonLayer;
      
      // Use a try-catch block to handle any errors during processing
      try {
        // Enrich the GeoJSON layer with census data after it loads
        const apiKey = process.env.REACT_APP_CENSUS_API_KEY;
        
        if (apiKey) {
          if (selectedLayer === "censusTracts" && Object.keys(censusTractData).length > 0) {
            // For census tracts, use GEOID field to match with census data
            injectCensusDataIntoLayer(geoJsonLayer, censusTractData, false)
              .then(() => {
                console.log("GeoJSON layer enriched with census tract data");
                
                // Apply adoption status renderer if we have status data
                if (Object.keys(adoptionStatusMap).length > 0) {
                  // Create a renderer based on adoption status
                  const adoptionRenderer = createAdoptionStatusRenderer(adoptionStatusMap);
                  console.log(`Created renderer with ${adoptionRenderer.uniqueValueInfos.length} adopted tracts`);
                  
                  // Apply the renderer to the layer
                  geoJsonLayer.renderer = adoptionRenderer;
                  
                  // Update the popup template with adoption status
                  geoJsonLayer.popupTemplate = createAdoptionStatusPopupTemplate(
                    geoJsonLayer.popupTemplate, 
                    adoptionStatusMap
                  );
                  
                  // Force a refresh of the layer
                  const currentVisibility = geoJsonLayer.visible;
                  geoJsonLayer.visible = false;
                  setTimeout(() => {
                    geoJsonLayer.visible = currentVisibility;
                  }, 100);
                }
              })
              .catch(console.error);
          } else if (selectedLayer === "zipCodes" && Object.keys(zipCodeData).length > 0) {
            // For ZIP codes, use ZIP_CODE field to match with census data
            injectCensusDataIntoLayer(geoJsonLayer, zipCodeData, true)
              .then(() => {
                console.log("GeoJSON layer enriched with ZIP code data");
                
                // For ZIP codes we need a different approach since we don't have direct ZIP to adoption mapping
                // We could implement this based on your requirements
              })
              .catch(console.error);
          }
        }
      } catch (error) {
        console.error("Error processing layer:", error);
      }
      
      setLayerLoaded(true);
      view.goTo(geoJsonLayer.fullExtent).catch(console.warn);
    })
    .catch((error) => console.error("Error loading GeoJSON layer:", error));

    map.add(geoJsonLayer);

    // Use hitTest to open the popup on click with customized handling and error protection
    view.on("click", (event) => {
      view.hitTest(event).then((response) => {
        const result = response.results.find(
          (res) => res.graphic?.layer === geoJsonLayer
        );
        if (result) {
          const g = result.graphic;
          console.log("Clicked feature attributes:", g.attributes);
          
          try {
            // Safe popup handling with proper null checks
            if (!g.popupTemplate) {
              console.warn("No popupTemplate found on graphic");
              return;
            }
            
            // Get the popup template title and content safely
            let title = "";
            let content = "";
            
            // Handle title with template interpolation
            if (g.popupTemplate.title) {
              title = g.popupTemplate.title.replace(/\{([^}]+)\}/g, (match, key) => {
                return g.attributes && g.attributes[key] !== undefined ? g.attributes[key] : "N/A";
              });
            }
            
            // Handle content based on type with error protection
            if (typeof g.popupTemplate.content === "function") {
              try {
                content = g.popupTemplate.content(g);
              } catch (error) {
                console.error("Error executing popup content function:", error);
                content = "<p>Error generating popup content</p>";
              }
            } else if (g.popupTemplate.content) {
              content = g.popupTemplate.content;
            } else {
              content = "<p>No content defined</p>";
            }
            
            // Set popup properties safely
            view.popup.title = title;
            view.popup.content = content;
            view.popup.location = event.mapPoint;
            view.popup.visible = true;
          } catch (error) {
            console.error("Error during popup creation:", error);
            // Provide a fallback popup if there's an error
            view.popup.title = "Feature Information";
            view.popup.content = "Unable to display detailed information for this feature.";
            view.popup.location = event.mapPoint;
            view.popup.visible = true;
          }
        } else {
          console.warn("No feature from the GeoJSON layer was found at this click.");
        }
      }).catch(error => {
        console.error("Error in hitTest:", error);
      });
    });
  }, [selectedLayer, map, view, generateCensusTractContent, generateZipCodeContent, censusTractData, zipCodeData, adoptionStatusMap]);

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
    
    // Validate search inputs
    if (!searchField) {
      setSearchStatus("Please select a search field.");
      return;
    }
    
    if (!searchValue.trim()) {
      setSearchStatus("Please enter a search value.");
      return;
    }
    
    console.log("Starting search with field:", searchField, "value:", searchValue);
    
    // Perform the search with current popup template functions
    const result = await performSearch({
      view,
      geoJsonLayer: geoJsonLayerRef.current,
      searchField,
      searchValue,
      setSearchValue, // Pass the setter function to allow clearing the input
    });
    
    if (!result.success) {
      console.error("Search error:", result.message);
      setSearchStatus(result.message);
    } else {
      console.log("Search completed successfully.");
      // Clear any error status
      setSearchStatus("");
    }
  };

  // Toggle between census tract view and zip code view
  const toggleLayer = () => {
    setSelectedLayer((prev) =>
      prev === "censusTracts" ? "zipCodes" : "censusTracts"
    );
    // Reset search fields when toggling layers
    setSearchField("");
    setSearchValue("");
    setSearchStatus("");
  };

  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw" }}>
      <div ref={viewDivRef} style={{ height: "100%", width: "100%" }}></div>
      
      {/* Search Component with Toggle Button */}
      <SearchComponent
        searchField={searchField}
        setSearchField={setSearchField}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        onSearch={handleSearch}
        selectedLayer={selectedLayer}
        searchStatus={searchStatus}
        toggleLayer={toggleLayer}
      />
      
      {/* Polygon Selection Component */}
      {layerLoaded && geoJsonLayerRef.current && (
        <PolygonSelection 
          map={map} 
          view={view} 
          geoJsonLayer={geoJsonLayerRef.current} 
        />
      )}
    </div>
  );
};

export default ArcGISMap;