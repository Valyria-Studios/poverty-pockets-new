// src/utils/censusDataUtils.js
import axios from "axios";

// Base URL for Census API
const CENSUS_API_BASE = "https://api.census.gov/data";

/**
 * Normalize a Census Tract GEOID to ensure consistent format.
 * @param {string} geoid - The GEOID to normalize
 * @returns {string} Normalized GEOID
 */
export function normalizeTractGeoid(geoid) {
  if (!geoid) return null;
  
  // Convert to string in case it's a number
  let normalizedGeoid = String(geoid);
  
  // Remove any non-numeric characters (like decimal points)
  normalizedGeoid = normalizedGeoid.replace(/\D/g, '');
  
  // Remove '14000US' prefix if present
  if (normalizedGeoid.startsWith('14000')) {
    normalizedGeoid = normalizedGeoid.substring(5);
  }
  
  // Ensure it's 11 digits (standard format for tract GEOIDs)
  // If shorter, pad with leading zeros
  while (normalizedGeoid.length < 11) {
    normalizedGeoid = '0' + normalizedGeoid;
  }
  
  // If longer than 11 digits, truncate to the first 11
  if (normalizedGeoid.length > 11) {
    normalizedGeoid = normalizedGeoid.substring(0, 11);
  }
  
  return normalizedGeoid;
}

/**
 * Normalize a ZIP code to ensure consistent format.
 * @param {string|number} zipCode - The ZIP code to normalize
 * @returns {string} Normalized ZIP code
 */
export function normalizeZipCode(zipCode) {
  if (!zipCode) return null;
  
  // Convert to string in case it's a number
  let normalizedZip = String(zipCode);
  
  // Remove any non-numeric characters
  normalizedZip = normalizedZip.replace(/\D/g, '');
  
  // Standard ZIP codes are 5 digits, ensure it's 5 digits
  while (normalizedZip.length < 5) {
    normalizedZip = '0' + normalizedZip;
  }
  
  // Take only the first 5 digits if it's a ZIP+4
  if (normalizedZip.length > 5) {
    normalizedZip = normalizedZip.substring(0, 5);
  }
  
  return normalizedZip;
}

/**
 * Process census data to ensure consistent key format
 * @param {Object} censusData - Raw census data object
 * @param {Function} normalizeFunction - Function to normalize keys
 * @returns {Object} Processed census data with normalized keys
 */
function processCensusData(censusData, normalizeFunction) {
  const processed = {};
  
  // Iterate through all keys in the original data
  Object.keys(censusData).forEach(key => {
    // Normalize the key
    const normalizedKey = normalizeFunction(key);
    if (normalizedKey) {
      // Add the data under the normalized key
      processed[normalizedKey] = censusData[key];
      
      // If the normalized key is different from the original,
      // also keep the data under the original key for flexibility
      if (normalizedKey !== key) {
        processed[key] = censusData[key];
      }
    }
  });
  
  return processed;
}

/**
 * Fetches census data for multiple census tracts in batch
 * @param {string} apiKey - Census API key
 * @returns {Promise<Object>} - Promise resolving to a map of GEOIDs to census data
 */
export const fetchCensusTractsData = async (apiKey) => {
  if (!apiKey) {
    console.error("Census API key is required");
    return {};
  }

  try {
    console.log("Fetching Census tract data...");
    
    // Population count (Total Population) - from P1 dataset
    const populationUrl = `${CENSUS_API_BASE}/2020/dec/pl?get=P1_001N&for=tract:*&in=state:06&key=${apiKey}`;
    
    // American Community Survey data for:
    // - Employment Rate (DP03_0004PE)
    // - Total Households (DP02_0001E)
    // - Median Household Income (S1901_C01_012E)
    const acsUrl = `${CENSUS_API_BASE}/2021/acs/acs5/profile?get=DP03_0004PE,DP02_0001E&for=tract:*&in=state:06&key=${apiKey}`;
    const incomeUrl = `${CENSUS_API_BASE}/2021/acs/acs5/subject?get=S1901_C01_012E&for=tract:*&in=state:06&key=${apiKey}`;
    
    // Parallel requests to improve performance
    console.log("Sending Census API requests...");
    const [populationRes, acsRes, incomeRes] = await Promise.all([
      axios.get(populationUrl),
      axios.get(acsUrl),
      axios.get(incomeUrl)
    ]);
    
    console.log("Received Census API responses, processing data...");
    
    // Process population data
    const populationData = {};
    if (populationRes.data && populationRes.data.length > 1) {
      // Get header indices
      const popHeaders = populationRes.data[0];
      const p1001nIdx = popHeaders.indexOf("P1_001N");
      const stateIdx = popHeaders.indexOf("state");
      const countyIdx = popHeaders.indexOf("county");
      const tractIdx = popHeaders.indexOf("tract");
      
      // Process rows (skip header row)
      for (let i = 1; i < populationRes.data.length; i++) {
        const row = populationRes.data[i];
        if (row && row.length === popHeaders.length) {
          // Create GEOID in same format as GeoJSON: STATE+COUNTY+TRACT
          const geoid = row[stateIdx] + row[countyIdx] + row[tractIdx];
          populationData[geoid] = {
            P1_001N: row[p1001nIdx]
          };
        }
      }
    }
    
    // Process ACS data (employment and households)
    const acsData = {};
    if (acsRes.data && acsRes.data.length > 1) {
      // Get header indices
      const acsHeaders = acsRes.data[0];
      const empRateIdx = acsHeaders.indexOf("DP03_0004PE");
      const householdsIdx = acsHeaders.indexOf("DP02_0001E");
      const stateIdx = acsHeaders.indexOf("state");
      const countyIdx = acsHeaders.indexOf("county");
      const tractIdx = acsHeaders.indexOf("tract");
      
      // Process rows (skip header row)
      for (let i = 1; i < acsRes.data.length; i++) {
        const row = acsRes.data[i];
        if (row && row.length === acsHeaders.length) {
          const geoid = row[stateIdx] + row[countyIdx] + row[tractIdx];
          acsData[geoid] = {
            DP03_0004PE: row[empRateIdx],
            DP02_0001E: row[householdsIdx]
          };
        }
      }
    }
    
    // Process Income data
    const incomeData = {};
    if (incomeRes.data && incomeRes.data.length > 1) {
      // Get header indices
      const incHeaders = incomeRes.data[0];
      const incomeIdx = incHeaders.indexOf("S1901_C01_012E");
      const stateIdx = incHeaders.indexOf("state");
      const countyIdx = incHeaders.indexOf("county");
      const tractIdx = incHeaders.indexOf("tract");
      
      // Process rows (skip header row)
      for (let i = 1; i < incomeRes.data.length; i++) {
        const row = incomeRes.data[i];
        if (row && row.length === incHeaders.length) {
          const geoid = row[stateIdx] + row[countyIdx] + row[tractIdx];
          incomeData[geoid] = {
            S1901_C01_012E: row[incomeIdx]
          };
        }
      }
    }
    
    // Merge all datasets
    const mergedData = {};
    
    // Create a set of all GEOIDs from all datasets
    const allGeoids = new Set([
      ...Object.keys(populationData),
      ...Object.keys(acsData),
      ...Object.keys(incomeData)
    ]);
    
    // Merge data for each GEOID
    allGeoids.forEach(geoid => {
      mergedData[geoid] = {
        ...(populationData[geoid] || {}),
        ...(acsData[geoid] || {}),
        ...(incomeData[geoid] || {})
      };
    });
    
    console.log(`Raw census data fetched for ${Object.keys(mergedData).length} census tracts`);
    
    // Process the data to ensure consistent key format
    const processedData = processCensusData(mergedData, normalizeTractGeoid);
    
    console.log(`Processed census data for ${Object.keys(processedData).length} census tracts`);
    
    // Log a sample of the data
    const sampleKeys = Object.keys(processedData).slice(0, 3);
    sampleKeys.forEach(key => {
      console.log(`Sample data for GEOID ${key}:`, processedData[key]);
    });
    
    return processedData;
    
  } catch (error) {
    console.error("Error fetching census data:", error);
    return {};
  }
};

/**
 * Fetches ZIP Code Tabulation Area (ZCTA) data from the Census API
 * @param {string} apiKey - Census API key
 * @returns {Promise<Object>} - Promise resolving to a map of ZIP codes to census data
 */
export const fetchZipcodeData = async (apiKey) => {
  if (!apiKey) {
    console.error("Census API key is required");
    return {};
  }

  try {
    console.log("Fetching ZIP code data...");
    
    // Population count (Total Population)
    const populationUrl = `${CENSUS_API_BASE}/2020/dec/pl?get=P1_001N&for=zip%20code%20tabulation%20area:*&key=${apiKey}`;
    
    // American Community Survey data
    const acsUrl = `${CENSUS_API_BASE}/2021/acs/acs5/profile?get=DP03_0004PE,DP02_0001E&for=zip%20code%20tabulation%20area:*&key=${apiKey}`;
    const incomeUrl = `${CENSUS_API_BASE}/2021/acs/acs5/subject?get=S1901_C01_012E&for=zip%20code%20tabulation%20area:*&key=${apiKey}`;
    
    // Parallel requests
    console.log("Sending ZIP code data requests...");
    const [populationRes, acsRes, incomeRes] = await Promise.all([
      axios.get(populationUrl),
      axios.get(acsUrl),
      axios.get(incomeUrl)
    ]);
    
    console.log("Received ZIP code API responses, processing data...");
    
    // Process population data
    const populationData = {};
    if (populationRes.data && populationRes.data.length > 1) {
      const popHeaders = populationRes.data[0];
      const p1001nIdx = popHeaders.indexOf("P1_001N");
      const zctaIdx = popHeaders.indexOf("zip code tabulation area");
      
      for (let i = 1; i < populationRes.data.length; i++) {
        const row = populationRes.data[i];
        if (row && row.length === popHeaders.length) {
          const zipCode = row[zctaIdx];
          populationData[zipCode] = {
            P1_001N: row[p1001nIdx]
          };
        }
      }
    }
    
    // Process ACS data
    const acsData = {};
    if (acsRes.data && acsRes.data.length > 1) {
      const acsHeaders = acsRes.data[0];
      const empRateIdx = acsHeaders.indexOf("DP03_0004PE");
      const householdsIdx = acsHeaders.indexOf("DP02_0001E");
      const zctaIdx = acsHeaders.indexOf("zip code tabulation area");
      
      for (let i = 1; i < acsRes.data.length; i++) {
        const row = acsRes.data[i];
        if (row && row.length === acsHeaders.length) {
          const zipCode = row[zctaIdx];
          acsData[zipCode] = {
            DP03_0004PE: row[empRateIdx],
            DP02_0001E: row[householdsIdx]
          };
        }
      }
    }
    
    // Process Income data
    const incomeData = {};
    if (incomeRes.data && incomeRes.data.length > 1) {
      const incHeaders = incomeRes.data[0];
      const incomeIdx = incHeaders.indexOf("S1901_C01_012E");
      const zctaIdx = incHeaders.indexOf("zip code tabulation area");
      
      for (let i = 1; i < incomeRes.data.length; i++) {
        const row = incomeRes.data[i];
        if (row && row.length === incHeaders.length) {
          const zipCode = row[zctaIdx];
          incomeData[zipCode] = {
            S1901_C01_012E: row[incomeIdx]
          };
        }
      }
    }
    
    // Merge datasets
    const mergedData = {};
    
    // Create a set of all ZIP codes from all datasets
    const allZipCodes = new Set([
      ...Object.keys(populationData),
      ...Object.keys(acsData),
      ...Object.keys(incomeData)
    ]);
    
    // Merge data for each ZIP code
    allZipCodes.forEach(zipCode => {
      mergedData[zipCode] = {
        ...(populationData[zipCode] || {}),
        ...(acsData[zipCode] || {}),
        ...(incomeData[zipCode] || {})
      };
    });
    
    console.log(`Raw ZIP code data fetched for ${Object.keys(mergedData).length} ZIPs`);
    
    // Process the data to ensure consistent key format
    const processedData = processCensusData(mergedData, normalizeZipCode);
    
    console.log(`Processed ZIP code data for ${Object.keys(processedData).length} ZIPs`);
    
    // Log a sample of the data
    const sampleKeys = Object.keys(processedData).slice(0, 3);
    sampleKeys.forEach(key => {
      console.log(`Sample data for ZIP ${key}:`, processedData[key]);
    });
    
    return processedData;
    
  } catch (error) {
    console.error("Error fetching ZIP code census data:", error);
    return {};
  }
};

/**
 * Modified version of injectCensusDataIntoLayer that doesn't use applyEdits
 * @param {Object} layer - The ArcGIS GeoJSONLayer object
 * @param {Object} censusData - The census data mapped by ID
 * @param {boolean} isZipCodeLayer - Whether this is a ZIP code layer (true) or tract layer (false)
 * @returns {Promise<number>} - Number of features processed
 */
export async function injectCensusDataIntoLayer(layer, censusData, isZipCodeLayer = false) {
  if (!layer || !censusData || Object.keys(censusData).length === 0) {
    console.warn("Missing layer or census data for injection");
    return 0;
  }
  
  try {
    // Determine the ID field based on layer type
    let idField;
    
    if (isZipCodeLayer) {
      // For ZIP code layers, try common ZIP code field names
      const zipCodeFields = ["ZIP_CODE", "ZIP", "ZIPCODE", "ZCTA"];
      // Use the first field that exists in the layer's fields
      const layerFields = layer.fields?.map(f => f.name) || [];
      idField = zipCodeFields.find(field => layerFields.includes(field)) || "ZIP_CODE";
      console.log(`Using ${idField} as the ZIP code identifier field`);
    } else {
      // For census tract layers, use GEOID
      idField = "GEOID";
    }
    
    // Query all features to get their attributes
    const query = layer.createQuery();
    query.where = "1=1"; // Get all features
    query.outFields = ["*"];
    query.returnGeometry = false;
    
    const result = await layer.queryFeatures(query);
    
    if (!result.features || result.features.length === 0) {
      console.warn("No features returned from query");
      return 0;
    }
    
    console.log(`Processing ${result.features.length} features for census data injection`);
    
    // Instead of editing the layer, store the census data as a property on the layer
    // that we can access in popups and renderers
    const featureCensusData = new Map();
    
    // Process features and build the census data map
    result.features.forEach(feature => {
      const id = feature.attributes[idField];
      if (id) {
        // Normalize the ID to match our census data format
        const normalizedId = isZipCodeLayer 
          ? normalizeZipCode(id)
          : normalizeTractGeoid(id);
        
        // If we have census data for this ID, add it to our map
        if (censusData[normalizedId]) {
          featureCensusData.set(id, censusData[normalizedId]);
        }
      }
    });
    
    console.log(`Matched census data for ${featureCensusData.size} features`);
    
    // Store the census data on the layer for use in popups
    layer.featureCensusData = featureCensusData;
    
    // Update the popup template to include census data
    if (layer.popupTemplate && featureCensusData.size > 0) {
      const originalContent = layer.popupTemplate.content;
      
      layer.popupTemplate.content = (feature) => {
        // Get the original content first
        let content = typeof originalContent === "function" 
          ? originalContent(feature) 
          : originalContent || "";
          
        // Get the feature ID
        const featureId = feature.graphic.attributes[idField];
        
        // Get census data for this feature
        const featureCensusValues = featureCensusData.get(featureId);
        
        if (featureCensusValues) {
          // Apply census data to the feature's attributes for this popup only
          // This doesn't modify the layer's actual features
          Object.entries(featureCensusValues).forEach(([key, value]) => {
            feature.graphic.attributes[key] = value;
          });
        }
        
        return content;
      };
    }
    
    return featureCensusData.size;
  } catch (error) {
    console.error("Error during census data injection:", error);
    return 0;
  }
}