/**
 * Filters the GeoJSON features to include only those in the Bay Area counties.
 * @param {Object} caCounties - The GeoJSON object containing county data for California.
 * @returns {Object} A filtered GeoJSON object containing only Bay Area counties.
 */
export const getBayAreaGeoJSON = (caCounties) => {
  const bayAreaCountyFIPS = {
    Alameda: "06001",
    "Contra Costa": "06013",
    Marin: "06041",
    Napa: "06055",
    "San Francisco": "06075",
    "San Mateo": "06081",
    "Santa Clara": "06085",
    Solano: "06095",
    Sonoma: "06097",
  };

  // Filter features based on FIPS codes
  const bayAreaGeoJSON = {
    type: "FeatureCollection",
    features: caCounties.features.filter((feature) =>
      Object.values(bayAreaCountyFIPS).includes(feature.properties.COUNTYFP)
    ),
  };

  return bayAreaGeoJSON;
};

/**
 * Adds adopted and not adopted properties to features for visualization.
 * @param {Object} geoJSON - The GeoJSON object containing the features.
 * @param {Object} adoptionData - An object mapping feature IDs to their adoption status.
 * @returns {Object} A GeoJSON object with updated properties for adopted status.
 */
export const addAdoptionStatus = (geoJSON, adoptionData) => {
  const updatedFeatures = geoJSON.features.map((feature) => {
    const tractID = feature.properties.GEOID; // Adjust to match your GeoJSON structure
    const adoptedInfo = adoptionData[tractID] || {
      adopted: false,
      lastUpdatedBy: null,
      lastUpdateDate: null,
    };

    return {
      ...feature,
      properties: {
        ...feature.properties,
        adopted: adoptedInfo.adopted,
        lastUpdatedBy: adoptedInfo.lastUpdatedBy,
        lastUpdateDate: adoptedInfo.lastUpdateDate,
      },
    };
  });

  return {
    type: "FeatureCollection",
    features: updatedFeatures,
  };
};

/**
 * Filters features by adoption status (e.g., adopted or not adopted).
 * @param {Object} geoJSON - The GeoJSON object containing the features.
 * @param {boolean} adoptedStatus - The adoption status to filter by (true for adopted, false for not adopted).
 * @returns {Object} A GeoJSON object filtered by the specified adoption status.
 */
export const filterByAdoptionStatus = (geoJSON, adoptedStatus) => {
  const filteredFeatures = geoJSON.features.filter(
    (feature) => feature.properties.adopted === adoptedStatus
  );

  return {
    type: "FeatureCollection",
    features: filteredFeatures,
  };
};
