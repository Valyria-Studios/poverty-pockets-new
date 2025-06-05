import axios from "axios";

// Base URL for Census API
const CENSUS_API_BASE = "https://api.census.gov/data";

/**
 * Normalize a Census Tract GEOID to ensure consistent format.
 */
export function normalizeTractGeoid(geoid) {
  if (!geoid) return null;
  
  let normalizedGeoid = String(geoid);
  normalizedGeoid = normalizedGeoid.replace(/\D/g, '');
  
  if (normalizedGeoid.startsWith('14000')) {
    normalizedGeoid = normalizedGeoid.substring(5);
  }
  
  while (normalizedGeoid.length < 11) {
    normalizedGeoid = '0' + normalizedGeoid;
  }
  
  if (normalizedGeoid.length > 11) {
    normalizedGeoid = normalizedGeoid.substring(0, 11);
  }
  
  return normalizedGeoid;
}

/**
 * Normalize a ZIP code to ensure consistent format.
 */
export function normalizeZipCode(zipCode) {
  if (!zipCode) return null;
  
  let normalizedZip = String(zipCode);
  normalizedZip = normalizedZip.replace(/\D/g, '');
  
  while (normalizedZip.length < 5) {
    normalizedZip = '0' + normalizedZip;
  }
  
  if (normalizedZip.length > 5) {
    normalizedZip = normalizedZip.substring(0, 5);
  }
  
  return normalizedZip;
}

/**
 * Process census data to ensure consistent key format
 */
function processCensusData(censusData, normalizeFunction) {
  const processed = {};
  
  Object.keys(censusData).forEach(key => {
    const normalizedKey = normalizeFunction(key);
    if (normalizedKey) {
      processed[normalizedKey] = censusData[key];
      
      if (normalizedKey !== key) {
        processed[key] = censusData[key];
      }
    }
  });
  
  return processed;
}

/**
 * FIXED: Fetches census data for multiple census tracts in batch
 */
export const fetchCensusTractsData = async (apiKey) => {
  if (!apiKey || apiKey.trim() === '') {
    console.error("❌ Census API key is missing!");
    return {};
  }

  try {
    console.log("✅ Census API key found, length:", apiKey.length);
    console.log("🔍 Fetching Census tract data...");
    
    // FIXED URLs - removed problematic characters and simplified
    // Population count (Total Population) - 2020 Decennial Census
    const populationUrl = `${CENSUS_API_BASE}/2020/dec/pl?get=NAME,P1_001N&for=tract:*&in=state:06&key=${apiKey}`;
    
    // Employment Rate and Total Households - 2022 ACS 5-year (more recent data)
    const acsUrl = `${CENSUS_API_BASE}/2022/acs/acs5/profile?get=NAME,DP03_0004PE,DP02_0001E&for=tract:*&in=state:06&key=${apiKey}`;
    
    // Median Household Income - 2022 ACS 5-year Subject tables
    const incomeUrl = `${CENSUS_API_BASE}/2022/acs/acs5/subject?get=NAME,S1901_C01_012E&for=tract:*&in=state:06&key=${apiKey}`;
    
    console.log("Sending Census API requests...");
    console.log("Population URL (key hidden):", populationUrl.replace(apiKey, 'API_KEY'));
    console.log("ACS URL (key hidden):", acsUrl.replace(apiKey, 'API_KEY'));
    console.log("Income URL (key hidden):", incomeUrl.replace(apiKey, 'API_KEY'));
    
    // Make requests with proper error handling
    const requests = [
      axios.get(populationUrl).catch(err => {
        console.error("Population request failed:", err.response?.status, err.response?.data);
        return { data: [] };
      }),
      axios.get(acsUrl).catch(err => {
        console.error("ACS request failed:", err.response?.status, err.response?.data);
        return { data: [] };
      }),
      axios.get(incomeUrl).catch(err => {
        console.error("Income request failed:", err.response?.status, err.response?.data);
        return { data: [] };
      })
    ];
    
    const [populationRes, acsRes, incomeRes] = await Promise.all(requests);
    
    console.log("Received Census API responses, processing data...");
    console.log("Population response length:", populationRes.data?.length || 0);
    console.log("ACS response length:", acsRes.data?.length || 0);
    console.log("Income response length:", incomeRes.data?.length || 0);
    
    // Process population data
    const populationData = {};
    if (populationRes.data && populationRes.data.length > 1) {
      const popHeaders = populationRes.data[0];
      const p1001nIdx = popHeaders.indexOf("P1_001N");
      const stateIdx = popHeaders.indexOf("state");
      const countyIdx = popHeaders.indexOf("county");
      const tractIdx = popHeaders.indexOf("tract");
      
      console.log("Population headers:", popHeaders);
      
      for (let i = 1; i < populationRes.data.length; i++) {
        const row = populationRes.data[i];
        if (row && row.length === popHeaders.length) {
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
      const acsHeaders = acsRes.data[0];
      const empRateIdx = acsHeaders.indexOf("DP03_0004PE");
      const householdsIdx = acsHeaders.indexOf("DP02_0001E");
      const stateIdx = acsHeaders.indexOf("state");
      const countyIdx = acsHeaders.indexOf("county");
      const tractIdx = acsHeaders.indexOf("tract");
      
      console.log("ACS headers:", acsHeaders);
      
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
      const incHeaders = incomeRes.data[0];
      const incomeIdx = incHeaders.indexOf("S1901_C01_012E");
      const stateIdx = incHeaders.indexOf("state");
      const countyIdx = incHeaders.indexOf("county");
      const tractIdx = incHeaders.indexOf("tract");
      
      console.log("Income headers:", incHeaders);
      
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
    
    const allGeoids = new Set([
      ...Object.keys(populationData),
      ...Object.keys(acsData),
      ...Object.keys(incomeData)
    ]);
    
    allGeoids.forEach(geoid => {
      mergedData[geoid] = {
        ...(populationData[geoid] || {}),
        ...(acsData[geoid] || {}),
        ...(incomeData[geoid] || {})
      };
    });
    
    console.log(`✅ Raw census data fetched for ${Object.keys(mergedData).length} census tracts`);
    
    // Process the data to ensure consistent key format
    const processedData = processCensusData(mergedData, normalizeTractGeoid);
    
    console.log(`✅ Processed census data for ${Object.keys(processedData).length} census tracts`);
    
    // Log a sample of the data
    const sampleKeys = Object.keys(processedData).slice(0, 3);
    sampleKeys.forEach(key => {
      console.log(`Sample data for GEOID ${key}:`, processedData[key]);
    });
    
    return processedData;
    
  } catch (error) {
    console.error("❌ Error fetching census data:", error);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    return {};
  }
};

/**
 * FIXED: Fetches ZIP Code Tabulation Area (ZCTA) data from the Census API
 */
export const fetchZipcodeData = async (apiKey) => {
  if (!apiKey || apiKey.trim() === '') {
    console.error("❌ Census API key is missing!");
    return {};
  }

  try {
    console.log("🔍 Fetching ZIP code data...");
    
    // FIXED URLs for ZIP code data
    const populationUrl = `${CENSUS_API_BASE}/2020/dec/pl?get=NAME,P1_001N&for=zip%20code%20tabulation%20area:*&key=${apiKey}`;
    const acsUrl = `${CENSUS_API_BASE}/2022/acs/acs5/profile?get=NAME,DP03_0004PE,DP02_0001E&for=zip%20code%20tabulation%20area:*&key=${apiKey}`;
    const incomeUrl = `${CENSUS_API_BASE}/2022/acs/acs5/subject?get=NAME,S1901_C01_012E&for=zip%20code%20tabulation%20area:*&key=${apiKey}`;
    
    console.log("Sending ZIP code data requests...");
    
    const requests = [
      axios.get(populationUrl).catch(err => {
        console.error("ZIP Population request failed:", err.response?.status, err.response?.data);
        return { data: [] };
      }),
      axios.get(acsUrl).catch(err => {
        console.error("ZIP ACS request failed:", err.response?.status, err.response?.data);
        return { data: [] };
      }),
      axios.get(incomeUrl).catch(err => {
        console.error("ZIP Income request failed:", err.response?.status, err.response?.data);
        return { data: [] };
      })
    ];
    
    const [populationRes, acsRes, incomeRes] = await Promise.all(requests);
    
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
    
    const allZipCodes = new Set([
      ...Object.keys(populationData),
      ...Object.keys(acsData),
      ...Object.keys(incomeData)
    ]);
    
    allZipCodes.forEach(zipCode => {
      mergedData[zipCode] = {
        ...(populationData[zipCode] || {}),
        ...(acsData[zipCode] || {}),
        ...(incomeData[zipCode] || {})
      };
    });
    
    console.log(`✅ Raw ZIP code data fetched for ${Object.keys(mergedData).length} ZIPs`);
    
    const processedData = processCensusData(mergedData, normalizeZipCode);
    
    console.log(`✅ Processed ZIP code data for ${Object.keys(processedData).length} ZIPs`);
    
    const sampleKeys = Object.keys(processedData).slice(0, 3);
    sampleKeys.forEach(key => {
      console.log(`Sample data for ZIP ${key}:`, processedData[key]);
    });
    
    return processedData;
    
  } catch (error) {
    console.error("❌ Error fetching ZIP code census data:", error);
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