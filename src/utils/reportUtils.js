/**
 * Utility functions for generating reports from ArcGIS features
 */

/**
 * Formats census data for report display
 * @param {Object} attributes - Feature attributes from ArcGIS feature
 * @returns {Object} Formatted data object with readable labels and values
 */
export const formatCensusData = (attributes) => {
    if (!attributes) return {};
    
    // Define known fields and their readable labels
    const fieldMappings = {
      // Population data (2020 Decennial Census)
      P1_001N: { label: "Total Population", format: value => value || "N/A" },
      
      // American Community Survey fields (DP03, DP02, etc)
      DP03_0004PE: { label: "Employment Rate", format: value => value ? `${value}%` : "N/A" },
      DP02_0001E: { label: "Total Households", format: value => value || "N/A" },
      S1901_C01_012E: { label: "Median Household Income", format: value => value ? `$${value}` : "N/A" },
      
      // Geographic identifiers
      GEOID: { label: "Census GEOID", format: value => value || "N/A" },
      NAME: { label: "Census Name", format: value => value || "N/A" },
      NAMELSAD: { label: "Census Tract Name", format: value => value || "N/A" },
      ZIP_CODE: { label: "ZIP Code", format: value => value || "N/A" },
      
      // Other fields from poverty data
      adoption_status: { label: "Adoption Status", format: value => value || "Not Adopted" },
      lastUpdatedBy: { label: "Last Updated By", format: value => value || "N/A" },
      lastUpdateDate: { label: "Last Update Date", format: value => value || "N/A" },
    };
    
    // Build formatted data object
    const formattedData = {};
    
    // First add known fields in a specific order
    Object.keys(fieldMappings).forEach(key => {
      if (attributes[key] !== undefined && attributes[key] !== null) {
        const { label, format } = fieldMappings[key];
        formattedData[label] = format(attributes[key]);
      }
    });
    
    // Then add any remaining fields that weren't explicitly mapped
    Object.keys(attributes).forEach(key => {
      // Skip fields already processed and system fields
      if (
        fieldMappings[key] || 
        key.startsWith('__') || 
        ['OBJECTID', 'FID', 'Shape', 'SHAPE'].includes(key)
      ) {
        return;
      }
      
      // Format the key as a readable label (e.g. "my_field" -> "My Field")
      const label = key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^\w/, c => c.toUpperCase());
      
      formattedData[label] = attributes[key];
    });
    
    return formattedData;
  };
  
  /**
   * Extracts a human-readable name for a feature
   * @param {Object} feature - ArcGIS feature 
   * @returns {String} Best available name for the feature
   */
  export const getFeatureName = (feature) => {
    if (!feature || !feature.attributes) {
      return "Unknown Feature";
    }
    
    const attrs = feature.attributes;
    
    // Try different name fields in order of preference
    return attrs.NAMELSAD || 
           attrs.NAME || 
           (attrs.ZIP_CODE ? `ZIP Code ${attrs.ZIP_CODE}` : null) ||
           (attrs.ZIPCODE ? `ZIP Code ${attrs.ZIPCODE}` : null) ||
           (attrs.ZIP ? `ZIP Code ${attrs.ZIP}` : null) ||
           (attrs.GEOID ? `GEOID ${attrs.GEOID}` : null) ||
           (attrs.OBJECTID ? `Feature ID ${attrs.OBJECTID}` : null) ||
           (attrs.FID ? `Feature ID ${attrs.FID}` : null) ||
           "Unnamed Feature";
  };
  
  /**
   * Calculates totals for numeric fields across multiple features
   * @param {Array} features - Array of ArcGIS features
   * @returns {Object} Totals for each numeric field
   */
  export const calculateTotals = (features) => {
    if (!features || features.length === 0) {
      return {};
    }
    
    // Fields that should be summed
    const sumFields = ["P1_001N", "DP02_0001E"];
    
    // Fields where we want the average
    const avgFields = ["DP03_0004PE", "S1901_C01_012E"];
    
    const totals = {};
    const counts = {};
    
    // Initialize totals and counts
    sumFields.forEach(field => {
      totals[field] = 0;
      counts[field] = 0;
    });
    
    avgFields.forEach(field => {
      totals[field] = 0;
      counts[field] = 0;
    });
    
    // Calculate sums and counts
    features.forEach(feature => {
      const attrs = feature.attributes || {};
      
      // Process sum fields
      sumFields.forEach(field => {
        if (attrs[field] !== undefined && attrs[field] !== null) {
          const value = parseFloat(attrs[field]);
          if (!isNaN(value)) {
            totals[field] += value;
            counts[field]++;
          }
        }
      });
      
      // Process average fields
      avgFields.forEach(field => {
        if (attrs[field] !== undefined && attrs[field] !== null) {
          const value = parseFloat(attrs[field]);
          if (!isNaN(value)) {
            totals[field] += value;
            counts[field]++;
          }
        }
      });
    });
    
    // Format the results with readable labels
    const result = {
      featureCount: features.length,
    };
    
    // Calculate and format sums
    sumFields.forEach(field => {
      if (counts[field] > 0) {
        const label = field === "P1_001N" 
          ? "Total Population" 
          : field === "DP02_0001E" 
            ? "Total Households" 
            : field;
            
        result[label] = Math.round(totals[field]);
      }
    });
    
    // Calculate and format averages
    avgFields.forEach(field => {
      if (counts[field] > 0) {
        const avg = totals[field] / counts[field];
        
        const label = field === "DP03_0004PE" 
          ? "Average Employment Rate" 
          : field === "S1901_C01_012E" 
            ? "Average Median Household Income" 
            : `Average ${field}`;
        
        if (field === "DP03_0004PE") {
          result[label] = `${avg.toFixed(1)}%`;
        } else if (field === "S1901_C01_012E") {
          result[label] = `$${Math.round(avg).toLocaleString()}`;
        } else {
          result[label] = avg.toFixed(2);
        }
      }
    });
    
    return result;
  };
  
  export default {
    formatCensusData,
    getFeatureName,
    calculateTotals
  };