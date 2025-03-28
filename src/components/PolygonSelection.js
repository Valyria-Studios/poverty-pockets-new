import React, { useState, useRef, useEffect } from "react";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import Color from "@arcgis/core/Color";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import { jsPDF } from "jspdf";
import 'jspdf-autotable';

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
  }, [view, selectionMode, selectedFeatures]);
  
  // Handle map clicks for selection
  const handleMapClick = async (event) => {
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
  };
  
  // Update the graphics in the selection layer
  const updateSelectionGraphics = (features) => {
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
  };
  
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
      // Create a new PDF document
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.text("Selected Features Report", 14, 22);
      
      // Add date
      const date = new Date().toLocaleDateString();
      doc.setFontSize(10);
      doc.text(`Generated on: ${date}`, 14, 30);
      
      // Add summary
      doc.setFontSize(12);
      doc.text(`Number of features selected: ${selectedFeatures.length}`, 14, 40);
      
      // Prepare data for the table
      const tableData = [];
      
      // Collect all unique attribute keys across selected features
      const allKeys = new Set();
      selectedFeatures.forEach(feature => {
        Object.keys(feature.attributes).forEach(key => {
          if (!key.startsWith('__') && !['FID', 'OBJECTID', 'OID', 'Shape', 'SHAPE'].includes(key)) {
            allKeys.add(key);
          }
        });
      });
      
      // Process each feature for the report
      selectedFeatures.forEach((feature, index) => {
        // Feature name or identifier
        let featureName = feature.attributes.NAME || 
                          feature.attributes.NAMELSAD || 
                          feature.attributes.ZIP_CODE || 
                          `Feature ${index + 1}`;
                          
        // For detailed feature report in jsPDF
        doc.setFontSize(14);
        doc.text(`Feature: ${featureName}`, 14, 50 + index * 120);
        
        // Create a details table for this feature
        const featureData = [];
        
        // Add rows for each attribute
        Array.from(allKeys).forEach(key => {
          if (feature.attributes[key] !== undefined && feature.attributes[key] !== null) {
            featureData.push([key, String(feature.attributes[key])]);
          }
        });
        
        // Add the table to the PDF
        doc.autoTable({
          startY: 55 + index * 120,
          head: [['Attribute', 'Value']],
          body: featureData,
          margin: { top: 10 },
          styles: { overflow: 'linebreak' },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 100 }
          }
        });
        
        // For summary table at the beginning
        tableData.push([
          featureName,
          feature.attributes.P1_001N || 'N/A', // Population
          feature.attributes.DP03_0004PE ? `${feature.attributes.DP03_0004PE}%` : 'N/A', // Employment Rate
          feature.attributes.S1901_C01_012E ? `$${feature.attributes.S1901_C01_012E}` : 'N/A' // Median Income
        ]);
      });
      
      // Add a summary table at the beginning
      doc.setFontSize(12);
      doc.text("Summary of Selected Features", 14, 50);
      
      doc.autoTable({
        startY: 55,
        head: [['Feature', 'Population', 'Employment Rate', 'Median Income']],
        body: tableData,
        margin: { top: 10 }
      });
      
      // Save the PDF
      doc.save("SelectedFeaturesReport.pdf");
      
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