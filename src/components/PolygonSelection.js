import React, { useState, useRef, useEffect, useCallback } from "react";

const PolygonSelection = ({ map, view, geoJsonLayer }) => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const originalRendererRef = useRef(null);

  // Helper function to get feature ID
  const getFeatureId = useCallback((feature) => {
    if (!feature || !feature.attributes) return null;
    
    return feature.attributes.OBJECTID || 
           feature.attributes.FID || 
           feature.attributes.OID ||
           feature.attributes.GEOID ||
           feature.attributes.NAME;
  }, []);

  // Save the original renderer when component mounts
  useEffect(() => {
    if (geoJsonLayer && !originalRendererRef.current) {
      // Store the original renderer to restore it later
      originalRendererRef.current = geoJsonLayer.renderer;
      console.log("Original renderer saved:", originalRendererRef.current);
    }
  }, [geoJsonLayer]);

  // Highlight selected features by modifying the renderer
  const updateHighlights = useCallback(() => {
    if (!geoJsonLayer || !originalRendererRef.current) {
      console.warn("Layer or original renderer not available");
      return;
    }

    try {
      console.log(`Updating highlights for ${selectedFeatureIds.length} features`);
      
      // If no selections, restore original renderer
      if (selectedFeatureIds.length === 0) {
        geoJsonLayer.renderer = originalRendererRef.current;
        console.log("Restored original renderer - no features selected");
        return;
      }

      // Create a unique value renderer based on feature IDs
      const uniqueValueRenderer = {
        type: "unique-value",
        field: "OBJECTID", // Fallback to common ID fields below if needed
        defaultSymbol: originalRendererRef.current.symbol || {
          type: "simple-fill",
          color: [200, 200, 200, 0.6],
          outline: {
            color: [70, 70, 70, 0.9],
            width: 1
          }
        },
        uniqueValueInfos: []
      };

      // Add unique value info for each selected feature
      selectedFeatureIds.forEach(id => {
        uniqueValueRenderer.uniqueValueInfos.push({
          value: id,
          symbol: {
            type: "simple-fill",
            color: [255, 255, 0, 0.5], // Bright yellow
            outline: {
              color: [255, 0, 0, 1], // Red
              width: 3
            }
          }
        });
      });

      // Handle different ID field names
      // Try different ID fields depending on what's in the data
      geoJsonLayer.fields.forEach(field => {
        if (["OBJECTID", "FID", "OID", "GEOID"].includes(field.name)) {
          console.log(`Using ${field.name} as the ID field for renderer`);
          uniqueValueRenderer.field = field.name;
        }
      });

      // Apply the renderer to the layer
      geoJsonLayer.renderer = uniqueValueRenderer;
      
      // Force the layer to refresh
      const visible = geoJsonLayer.visible;
      geoJsonLayer.visible = false;
      setTimeout(() => {
        geoJsonLayer.visible = visible;
        console.log("Layer visibility toggled to refresh renderer");
      }, 50);
      
    } catch (error) {
      console.error("Error updating highlights:", error);
      // Restore original renderer in case of error
      if (originalRendererRef.current) {
        geoJsonLayer.renderer = originalRendererRef.current;
      }
    }
  }, [geoJsonLayer, selectedFeatureIds]);

  // Update highlights when selected features change
  useEffect(() => {
    updateHighlights();
  }, [selectedFeatureIds, updateHighlights]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedFeatureIds([]);
    
    // Restore original renderer
    if (geoJsonLayer && originalRendererRef.current) {
      geoJsonLayer.renderer = originalRendererRef.current;
      console.log("Selection cleared, original renderer restored");
    }
  }, [geoJsonLayer]);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prevMode => {
      const newMode = !prevMode;
      
      // If turning off selection mode, clear all selections
      if (!newMode) {
        clearSelection();
      } else {
        console.log("Selection mode activated");
      }
      
      return newMode;
    });
  }, [clearSelection]);

  // Handle clicks on the map for feature selection
  const handleMapClick = useCallback(async (event) => {
    if (!selectionMode || !geoJsonLayer || isSelecting) return;
    
    try {
      setIsSelecting(true);
      console.log("Processing map click for feature selection");
      
      // Perform hit test to see if a feature was clicked
      const response = await view.hitTest(event);
      const result = response.results.find(
        result => result.graphic?.layer === geoJsonLayer
      );
      
      if (result && result.graphic) {
        const feature = result.graphic;
        const featureId = getFeatureId(feature);
        
        console.log(`Feature clicked: ${featureId}`);
        
        if (!featureId) {
          console.warn("Could not determine feature ID for selection");
          setIsSelecting(false);
          return;
        }
        
        // Toggle selection for this feature
        setSelectedFeatureIds(prevIds => {
          const isAlreadySelected = prevIds.includes(featureId);
          
          if (isAlreadySelected) {
            // Remove from selection
            console.log(`Removing feature ${featureId} from selection`);
            return prevIds.filter(id => id !== featureId);
          } else {
            // Add to selection
            console.log(`Adding feature ${featureId} to selection`);
            return [...prevIds, featureId];
          }
        });
      } else {
        console.log("Click did not hit any features in the target layer");
      }
    } catch (error) {
      console.error("Error during selection process:", error);
    } finally {
      setIsSelecting(false);
    }
  }, [selectionMode, geoJsonLayer, isSelecting, getFeatureId, view]);

  // Set up click handler when selection mode is active
  useEffect(() => {
    if (!view || !selectionMode) return;
    
    console.log("Adding click handler for selection mode");
    const clickHandler = view.on("click", handleMapClick);
    
    return () => {
      if (clickHandler) {
        console.log("Removing click handler");
        clickHandler.remove();
      }
    };
  }, [view, selectionMode, handleMapClick]);
  
  // Restore original renderer when component unmounts
  useEffect(() => {
    return () => {
      if (geoJsonLayer && originalRendererRef.current) {
        geoJsonLayer.renderer = originalRendererRef.current;
        console.log("Component unmounted, original renderer restored");
      }
    };
  }, [geoJsonLayer]);

  // Generate a report from the selected features
  const generateReport = useCallback(async () => {
    if (selectedFeatureIds.length === 0) {
      alert("Please select at least one feature to generate a report.");
      return;
    }

    try {
      console.log(`Generating report for ${selectedFeatureIds.length} features`);
      
      // Query the selected features to get full feature data
      const query = geoJsonLayer.createQuery();
      const idField = geoJsonLayer.objectIdField || "OBJECTID";
      query.where = `${idField} IN (${selectedFeatureIds.join(',')})`;
      query.outFields = ["*"];
      
      const results = await geoJsonLayer.queryFeatures(query);
      const selectedFeatures = results.features;
      
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
      
      console.log("Report generated successfully");
    } catch (error) {
      console.error("Error generating report:", error);
      alert("There was an error generating the report. Please try again.");
    }
  }, [geoJsonLayer, selectedFeatureIds]);

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
      
      {selectedFeatureIds.length > 0 && (
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
          Generate Report ({selectedFeatureIds.length})
        </button>
      )}
    </div>
  );
};

export default PolygonSelection;