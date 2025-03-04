import { useEffect } from "react";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";

const IncomeLayer = ({ map, geojsonUrl }) => {
  useEffect(() => {
    // Renderer for adoption status with transparency
    const adoptionStatusRenderer = {
      type: "unique-value", // Renderer type for unique values
      field: "adoption_status", // Field for adoption status
      defaultSymbol: {
        type: "simple-fill",
        color: "rgba(128, 128, 128, 0.3)", // Transparent gray for undefined status
        outline: {
          color: "black", // Black border for polygons
          width: 1,
        },
      },
      uniqueValueInfos: [
        {
          value: "adopted", // Value for "adopted" status
          symbol: {
            type: "simple-fill",
            color: "rgba(34, 197, 94, 0.4)", // Semi-transparent green for adopted
            outline: {
              color: "black", // Black border
              width: 1,
            },
          },
          label: "Adopted",
        },
        {
          value: "not adopted", // Value for "not adopted" status
          symbol: {
            type: "simple-fill",
            color: "rgba(255, 69, 58, 0.4)", // Semi-transparent red for not adopted
            outline: {
              color: "black", // Black border
              width: 1,
            },
          },
          label: "Not Adopted",
        },
      ],
    };

    // Renderer for borders with transparency
    const bordersRenderer = {
      type: "simple", // Simple renderer for polygons
      symbol: {
        type: "simple-fill", // Fill symbol
        color: "rgba(0, 0, 0, 0)", // Fully transparent fill
        outline: {
          color: "black", 
          width: 1.5, 
        },
      },
    };

    // GeoJSONLayer for income and adoption status
    const incomeAdoptionLayer = new GeoJSONLayer({
      url: geojsonUrl, // URL of the GeoJSON file
      renderer: adoptionStatusRenderer, // Renderer for adoption status
      popupTemplate: {
        title: "{NAMELSAD}",
        content: `
          <b>GEOID:</b> {GEOID}<br>
          <b>Adoption Status:</b> {adoption_status}<br>
          <b>Last Updated By:</b> {last_updated_by}<br>
          <b>Last Update Date:</b> {last_update_date}
        `,
      },
    });

    // GeoJSONLayer for borders
    const bordersLayer = new GeoJSONLayer({
      url: `${process.env.PUBLIC_URL}/BayAreaZipCodes.geojson`, // URL for borders GeoJSON
      renderer: bordersRenderer, // Renderer for borders
    });

    // Add layers to the map
    map.addMany([incomeAdoptionLayer, bordersLayer]);

    // Cleanup: Remove layers on component unmount
    return () => {
      map.removeMany([incomeAdoptionLayer, bordersLayer]);
    };
  }, [map, geojsonUrl]);

  return null; // No visible DOM element rendered by this component
};

export default IncomeLayer;
