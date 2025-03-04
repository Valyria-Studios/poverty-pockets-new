import React, { useEffect, useState, useRef } from "react";
import MapView from "@arcgis/core/views/MapView";
import WebMap from "@arcgis/core/WebMap";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import * as pdfMake from "pdfmake/build/pdfmake";

const ArcGISMap = ({ geojsonUrl }) => {
  const mapRef = useRef(null);
  const [selectedPolygons, setSelectedPolygons] = useState([]);
  const [layer, setLayer] = useState(null);
  const [selectionEnabled, setSelectionEnabled] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize WebMap and MapView
    const webMap = new WebMap({
      basemap: "topo-vector",
    });

    const view = new MapView({
      container: mapRef.current,
      map: webMap,
      center: [-98.35, 39.5], // USA Center
      zoom: 5,
    });

    // Load GeoJSONLayer
    const geoLayer = new GeoJSONLayer({
      url: geojsonUrl,
      outFields: ["*"],
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [0, 0, 255, 0.3],
          outline: { color: "black", width: 1 },
        },
      },
      // Add labeling to show the Census Tract NAME
      labelingInfo: [{
        labelExpressionInfo: { expression: "$feature.NAME" },
        symbol: {
          type: "text",
          color: "black",
          haloColor: "white",
          haloSize: "1px",
          font: { size: "12px" }
        },
        labelPlacement: "always-horizontal"
      }]
    });

    webMap.add(geoLayer);
    setLayer(geoLayer);

    // Add Click Event for Polygon Selection (Only when selection is enabled)
    view.on("click", async (event) => {
      if (!selectionEnabled) return;

      const response = await view.hitTest(event);
      const feature = response.results.find((res) => res.graphic?.layer === geoLayer);

      if (feature) {
        const featureId = feature.graphic.attributes.OBJECTID;
        setSelectedPolygons((prev) =>
          prev.includes(featureId)
            ? prev.filter((id) => id !== featureId) // Deselect
            : [...prev, featureId] // Select
        );

        // Change Color of Selected Feature
        feature.graphic.symbol = {
          type: "simple-fill",
          color: prev.includes(featureId) ? [0, 0, 255, 0.3] : [255, 0, 0, 0.5], // Red for selected
          outline: { color: "black", width: 1 },
        };
      }
    });

    return () => view.destroy();
  }, [geojsonUrl, selectionEnabled]);

  // Start Selection
  const startSelection = () => {
    setSelectionEnabled(true);
  };

  // Generate Report
  const generateReport = async () => {
    if (!layer || selectedPolygons.length === 0) {
      alert("No polygons selected.");
      return;
    }

    // Fetch selected features
    const query = layer.createQuery();
    query.where = `OBJECTID IN (${selectedPolygons.join(",")})`;
    const results = await layer.queryFeatures(query);

    // Format report data
    const reportData = results.features.map((feature) => ({
      ID: feature.attributes.OBJECTID,
      Name: feature.attributes.NAME || "N/A",
      Area: feature.attributes.AREA || "Unknown",
      Adoption_Status: feature.attributes.adoption_status || "not adopted",
    }));

    console.log("Generated Report Data:", reportData);

    // Generate PDF
    const docDefinition = {
      content: [
        { text: "Selected Polygons Report", style: "header" },
        {
          table: {
            body: [["ID", "Name", "Area"], ...reportData.map((r) => [r.ID, r.Name, r.Area])],
          },
        },
      ],
      styles: {
        header: { fontSize: 18, bold: true, marginBottom: 10 },
      },
    };
    pdfMake.createPdf(docDefinition).download("Polygon_Report.pdf");
  };

  return (
    <div style={{ position: "relative" }}>
      <div ref={mapRef} style={{ width: "100%", height: "500px" }}></div>

      {/* Start Selection Button (Bottom Right) */}
      {!selectionEnabled && (
        <button
          onClick={startSelection}
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            padding: "10px 15px",
            backgroundColor: "#007BFF",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Start Selection
        </button>
      )}

      {/* Generate Report Button (Bottom Right) */}
      {selectionEnabled && (
        <button
          onClick={generateReport}
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            padding: "10px 15px",
            backgroundColor: "#28A745",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Generate Report
        </button>
      )}
    </div>
  );
};

export default ArcGISMap;
