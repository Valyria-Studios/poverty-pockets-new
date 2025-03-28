import React, { useState, useRef, useEffect, useCallback } from "react";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import Color from "@arcgis/core/Color";

// Define the symbols for selected and unselected features
const SELECTED_SYMBOL = new SimpleFillSymbol({
  color: new Color([255, 140, 0, 0.5]),
  outline: new SimpleLineSymbol({
    color: new Color([255, 140, 0, 1]),
    width: 2
  })
});

const PolygonSelection = ({ map, view, geoJsonLayer }) => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const selectionLayerRef = useRef(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
  // Update the graphics in the selection layer
  const updateSelectionGraphics = useCallback((features) => {
    if (!selectionLayerRef.current) return;
    
    // Clear existing graphics
    selectionLayerRef.current.removeAll();
    
    // Add new graphics for each selected feature
    features.forEach(feature => {
      const selectionGraphic = new Graphic({
        geometry: feature.geometry,
        symbol: SELECTED_SYMBOL
      });
      
      selectionLayerRef.current.add(selectionGraphic);
    });
  }, []);
  
  // Handle map clicks for selection
  const handleMapClick = useCallback(async (event) => {
    if (!selectionMode || !geoJsonLayer || isSelecting) return;
    
    try {
      setIsSelecting(true);
      
      // Perform hit test to see if a feature was clicked
      const response = await view.hitTest(event);
      const result = response.results.find(
        result => result.graphic?.layer === geoJsonLayer
      );
      
      if (result) {
        const feature = result.graphic;
        const featureId = feature.attributes.OBJECTID || feature.attributes.FID || feature.attributes.OID;
        
        // Check if feature is already selected
        const isAlreadySelected = selectedFeatures.some(f => 
          f.attributes.OBJECTID === featureId || f.attributes.FID === featureId || f.attributes.OID === featureId
        );
        
        if (isAlreadySelected) {
          // Remove from selection
          const updatedSelection = selectedFeatures.filter(f => 
            f.attributes.OBJECTID !== featureId && f.attributes.FID !== featureId && f.attributes.OID !== featureId
          );
          setSelectedFeatures(updatedSelection);
          
          // Update the graphics layer
          updateSelectionGraphics(updatedSelection);
        } else {
          // Add to selection
          const newSelection = [...selectedFeatures, feature];
          setSelectedFeatures(newSelection);
          
          // Update the graphics layer
          updateSelectionGraphics(newSelection);
        }
      }
    } catch (error) {
      console.error("Error during selection:", error);
    } finally {
      setIsSelecting(false);
    }
  }, [selectionMode, geoJsonLayer, isSelecting, selectedFeatures, updateSelectionGraphics, view]);
  
  // Initialize the selection layer when the map is ready
  useEffect(() => {
    if (!map) return;
    
    // Create a graphics layer for selections
    const selectionLayer = new GraphicsLayer({
      id: "selectionLayer",
      title: "Selected Features"
    });
    
    map.add(selectionLayer);
    selectionLayerRef.current = selectionLayer;
    
    // Cleanup function to remove the layer when unmounting
    return () => {
      if (map && selectionLayer) {
        map.remove(selectionLayer);
      }
    };
  }, [map]);
  
  // Set up the click handler when selection mode is active
  useEffect(() => {
    if (!view || !selectionMode) return;
    
    const clickHandler = view.on("click", handleMapClick);
    
    return () => {
      if (clickHandler) {
        clickHandler.remove();
      }
    };
  }, [view, selectionMode, handleMapClick]);
  
  // Toggle selection mode
  const toggleSelectionMode = () => {
    const newMode = !selectionMode;
    setSelectionMode(newMode);
    
    if (!newMode) {
      // If turning off selection mode, clear all selections
      clearSelection();
    }
  };
  
  // Clear all selections
  const clearSelection = () => {
    setSelectedFeatures([]);
    if (selectionLayerRef.current) {
      selectionLayerRef.current.removeAll();
    }
  };
  
  // Generate a report from the selected features
  const generateReport = async () => {
    if (selectedFeatures.length === 0) {
      alert("Please select at least one feature to generate a report.");
      return;
    }

    try {
      // Create a popup window with HTML content for report data
      const reportWindow = window.open('', '_blank', 'width=800,height=600');
      
      if (!reportWindow) {
        alert("Popup blocked! Please allow popups for this site to generate reports.");
        return;
      }
      
      // Start building HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Selected Features Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #2c3e50; }
            h2 { color: #3498db; margin-top: 20px; }
            .summary { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .print-button { background-color: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; }
            @media print { .print-button { display: none; } }
          </style>
        </head>
        <body>
          <button class="print-button" onclick="window.print()">Print Report</button>
          <h1>Selected Features Report</h1>
          <div class="summary">
            <p><strong>Generated on:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Number of features selected:</strong> ${selectedFeatures.length}</p>
          </div>
      `;
      
      // Add summary table
      htmlContent += `
        <h2>Summary of Selected Features</h2>
        <table>
          <tr>
            <th>Feature</th>
            <th>Population</th>
            <th>Employment Rate</th>
            <th>Median Income</th>
          </tr>
      `;
      
      // Collect all unique attribute keys across selected features
      const allKeys = new Set();
      selectedFeatures.forEach(feature => {
        Object.keys(feature.attributes).forEach(key => {
          if (!key.startsWith('__') && !['FID', 'OBJECTID', 'OID', 'Shape', 'SHAPE'].includes(key)) {
            allKeys.add(key);
          }
        });
      });
      
      // Add rows for each feature in the summary table
      selectedFeatures.forEach((feature, index) => {
        const featureName = feature.attributes.NAME || 
                          feature.attributes.NAMELSAD || 
                          feature.attributes.ZIP_CODE || 
                          `Feature ${index + 1}`;
        
        htmlContent += `
          <tr>
            <td>${featureName}</td>
            <td>${feature.attributes.P1_001N || 'N/A'}</td>
            <td>${feature.attributes.DP03_0004PE ? `${feature.attributes.DP03_0004PE}%` : 'N/A'}</td>
            <td>${feature.attributes.S1901_C01_012E ? `$${feature.attributes.S1901_C01_012E}` : 'N/A'}</td>
          </tr>
        `;
      });
      
      htmlContent += `</table>`;
      
      // Add detailed sections for each feature
      selectedFeatures.forEach((feature, index) => {
        const featureName = feature.attributes.NAME || 
                          feature.attributes.NAMELSAD || 
                          feature.attributes.ZIP_CODE || 
                          `Feature ${index + 1}`;
        
        htmlContent += `<h2>Details for: ${featureName}</h2>`;
        htmlContent += `<table><tr><th>Attribute</th><th>Value</th></tr>`;
        
        // Add rows for each attribute
        Array.from(allKeys).forEach(key => {
          if (feature.attributes[key] !== undefined && feature.attributes[key] !== null) {
            htmlContent += `<tr><td>${key}</td><td>${feature.attributes[key]}</td></tr>`;
          }
        });
        
        htmlContent += `</table>`;
      });
      
      // Close HTML content
      htmlContent += `
          </body>
        </html>
      `;
      
      // Write content to the window
      reportWindow.document.write(htmlContent);
      reportWindow.document.close();
      
    } catch (error) {
      console.error("Error generating report:", error);
      alert("There was an error generating the report. Please try again.");
    }
  };
  
  return (
    <div style={{ position: "absolute", bottom: "30px", left: "20px", zIndex: 1000, display: "flex", gap: "10px" }}>
      <button
        onClick={toggleSelectionMode}
        style={{
          padding: "10px 15px",
          backgroundColor: selectionMode ? "#dc3545" : "#007BFF",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          fontWeight: "bold"
        }}
      >
        {selectionMode ? "Cancel Selection" : "Select Features"}
      </button>
      
      {selectionMode && (
        <button
          onClick={clearSelection}
          style={{
            padding: "10px 15px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Clear Selection
        </button>
      )}
      
      {selectedFeatures.length > 0 && (
        <button
          onClick={generateReport}
          style={{
            padding: "10px 15px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Generate Report ({selectedFeatures.length})
        </button>
      )}
    </div>
  );
};

export default PolygonSelection;