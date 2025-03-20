// src/utils/censusDataUtils.js
import axios from "axios";

// Base URL for Census API
const CENSUS_API_BASE = "https://api.census.gov/data";

/**
 * Fetches census data for multiple census tracts in batch
 * @param {string} apiKey - Census API key
 * @param {Array} geoids - Array of GEOIDs for census tracts (format: "STATE+COUNTY+TRACT")
 * @returns {Promise<Object>} - Promise resolving to a map of GEOIDs to census data
 */
export const fetchCensusTractsData = async (apiKey) => {
  if (!apiKey) {
    console.error("Census API key is required");
    return {};
  }

  try {
    // Fetch key data points for all census tracts in California
    // We'll filter to Bay Area later when joining with GeoJSON
    
    // Population count (Total Population) - from P1 dataset
    const populationUrl = `${CENSUS_API_BASE}/2020/dec/pl?get=P1_001N&for=tract:*&in=state:06&key=${apiKey}`;
    
    // American Community Survey data for:
    // - Employment Rate (DP03_0004PE)
    // - Total Households (DP02_0001E)
    // - Median Household Income (S1901_C01_012E)
    const acsUrl = `${CENSUS_API_BASE}/2021/acs/acs5/profile?get=DP03_0004PE,DP02_0001E&for=tract:*&in=state:06&key=${apiKey}`;
    const incomeUrl = `${CENSUS_API_BASE}/2021/acs/acs5/subject?get=S1901_C01_012E&for=tract:*&in=state:06&key=${apiKey}`;
    
    // Parallel requests to improve performance
    const [populationRes, acsRes, incomeRes] = await Promise.all([
      axios.get(populationUrl),
      axios.get(acsUrl),
      axios.get(incomeUrl)
    ]);
    
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
        // Create GEOID in same format as GeoJSON: STATE+COUNTY+TRACT
        const geoid = row[stateIdx] + row[countyIdx] + row[tractIdx];
        populationData[geoid] = {
          P1_001N: row[p1001nIdx]
        };
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
        const geoid = row[stateIdx] + row[countyIdx] + row[tractIdx];
        acsData[geoid] = {
          DP03_0004PE: row[empRateIdx],
          DP02_0001E: row[householdsIdx]
        };
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
        const geoid = row[stateIdx] + row[countyIdx] + row[tractIdx];
        incomeData[geoid] = {
          S1901_C01_012E: row[incomeIdx]
        };
      }
    }
    
    // Merge all datasets
    const mergedData = {};
    
    // Use the population data keys as base
    Object.keys(populationData).forEach(geoid => {
      mergedData[geoid] = {
        ...populationData[geoid],
        ...(acsData[geoid] || {}),
        ...(incomeData[geoid] || {})
      };
    });
    
    console.log(`Fetched census data for ${Object.keys(mergedData).length} census tracts`);
    return mergedData;
    
  } catch (error) {
    console.error("Error fetching census data:", error);
    return {};
  }
};

/**
 * Fetches ZIP Code Tabulation Area (ZCTA) data from the Census API
 * Note: The Census API uses ZCTAs which are almost the same as ZIP codes
 * @param {string} apiKey - Census API key
 * @returns {Promise<Object>} - Promise resolving to a map of ZIP codes to census data
 */
export const fetchZipcodeData = async (apiKey) => {
  if (!apiKey) {
    console.error("Census API key is required");
    return {};
  }

  try {
    // Population count (Total Population)
    const populationUrl = `${CENSUS_API_BASE}/2020/dec/pl?get=P1_001N&for=zip%20code%20tabulation%20area:*&key=${apiKey}`;
    
    // American Community Survey data
    const acsUrl = `${CENSUS_API_BASE}/2021/acs/acs5/profile?get=DP03_0004PE,DP02_0001E&for=zip%20code%20tabulation%20area:*&key=${apiKey}`;
    const incomeUrl = `${CENSUS_API_BASE}/2021/acs/acs5/subject?get=S1901_C01_012E&for=zip%20code%20tabulation%20area:*&key=${apiKey}`;
    
    // Parallel requests
    const [populationRes, acsRes, incomeRes] = await Promise.all([
      axios.get(populationUrl),
      axios.get(acsUrl),
      axios.get(incomeUrl)
    ]);
    
    // Process population data
    const populationData = {};
    if (populationRes.data && populationRes.data.length > 1) {
      const popHeaders = populationRes.data[0];
      const p1001nIdx = popHeaders.indexOf("P1_001N");
      const zctaIdx = popHeaders.indexOf("zip code tabulation area");
      
      for (let i = 1; i < populationRes.data.length; i++) {
        const row = populationRes.data[i];
        const zipCode = row[zctaIdx];
        populationData[zipCode] = {
          P1_001N: row[p1001nIdx]
        };
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
        const zipCode = row[zctaIdx];
        acsData[zipCode] = {
          DP03_0004PE: row[empRateIdx],
          DP02_0001E: row[householdsIdx]
        };
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
        const zipCode = row[zctaIdx];
        incomeData[zipCode] = {
          S1901_C01_012E: row[incomeIdx]
        };
      }
    }
    
    // Merge datasets
    const mergedData = {};
    
    Object.keys(populationData).forEach(zipCode => {
      mergedData[zipCode] = {
        ...populationData[zipCode],
        ...(acsData[zipCode] || {}),
        ...(incomeData[zipCode] || {})
      };
    });
    
    console.log(`Fetched census data for ${Object.keys(mergedData).length} ZIP codes`);
    return mergedData;
    
  } catch (error) {
    console.error("Error fetching ZIP code census data:", error);
    return {};
  }
};

/**
 * Enriches GeoJSON features with census data
 * @param {Object} geoJsonLayer - ArcGIS GeoJSONLayer object
 * @param {Object} censusData - Map of GEOIDs to census data
 * @param {string} idField - Field name in GeoJSON that contains the census id
 */
export const enrichGeoJsonWithCensusData = async (geoJsonLayer, censusData, idField) => {
  if (!geoJsonLayer || !censusData || Object.keys(censusData).length === 0) {
    console.warn("Missing data for enrichment");
    return;
  }
  
  try {
    // Query all features to enrich them
    const query = geoJsonLayer.createQuery();
    query.where = "1=1"; // Get all features
    query.outFields = ["*"];
    query.returnGeometry = true;
    
    const result = await geoJsonLayer.queryFeatures(query);
    
    // Abort if no features found
    if (!result.features || result.features.length === 0) {
      console.warn("No features found to enrich with census data");
      return;
    }
    
    console.log(`Enriching ${result.features.length} features with census data`);
    
    // Create graphics to add back to the layer
    const updatedGraphics = result.features.map(feature => {
      // Get the GEOID or ZIP code from the feature
      const id = feature.attributes[idField];
      
      if (id && censusData[id]) {
        // Merge census data with feature attributes
        feature.attributes = {
          ...feature.attributes,
          ...censusData[id]
        };
      }
      
      return feature;
    });
    
    // Apply updates to the layer
    // Note: In a real application, you might need to use the layer's applyEdits method
    // This is a simplified approach that assumes the GeoJSON source can be updated
    console.log(`Updated ${updatedGraphics.length} features with census data`);
    
    return updatedGraphics;
  } catch (error) {
    console.error("Error enriching GeoJSON with census data:", error);
  }
};