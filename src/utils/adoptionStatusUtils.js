// src/utils/adoptionStatusUtils.js

/**
 * Checks if a census tract ID appears in a comma-separated list of tracts
 * @param {string} tractId - The census tract ID to check
 * @param {string} commaSeparatedList - List of tract IDs separated by commas
 * @returns {boolean} True if the tract ID is in the list
 */
export function isTractInList(tractId, commaSeparatedList) {
    if (!tractId || !commaSeparatedList) return false;
    
    // Standardize the tract ID format
    const standardizedTractId = String(tractId).trim();
    
    // Split the list and trim each entry
    const tracts = commaSeparatedList.split(',').map(tract => tract.trim());
    
    // Check if the tract ID is in the list
    return tracts.some(tract => tract === standardizedTractId);
}
  
/**
 * Processes CSV data to determine adoption status for census tracts
 * @param {Array} povertyData - The CSV data with tract information
 * @returns {Object} Map of tract IDs to adoption status
 */
export function processAdoptionStatus(povertyData) {
    const adoptionStatusMap = {};
    
    // Create a set of all adopted census tracts and a set of all tracts in the CSV
    const adoptedTracts = new Set();
    const allCsvTracts = new Set();
    
    // First pass: identify all tracts in the CSV and those marked as adopted
    povertyData.forEach(row => {
        // Process the "Census Tract" column for each row
        const censusTract = row["Census Tract"];
        if (censusTract && censusTract.trim()) {
            const tractId = censusTract.trim();
            
            // Add this tract to our set of all tracts in the CSV
            allCsvTracts.add(tractId);
            
            // Check if this tract is marked as adopted in the Adoption Status column
            const isAdopted = row["Adoption Status"]?.toLowerCase() === "adopted";
            
            if (isAdopted) {
                adoptedTracts.add(tractId);
            }
            
            // Check all comma-separated lists for this tract ID
            const churchesList = row["Churches"] || "";
            const nonProfitsList = row["Non-Profits"] || "";
            const businessList = row["Local Business"] || "";
            
            // If the tract ID appears in any of these lists, mark it as adopted
            if (isTractInList(tractId, churchesList) || 
                isTractInList(tractId, nonProfitsList) || 
                isTractInList(tractId, businessList)) {
                adoptedTracts.add(tractId);
            }
        }
    });
    
    console.log(`Found ${allCsvTracts.size} total tracts in CSV data`);
    console.log(`Found ${adoptedTracts.size} adopted tracts from CSV data`);
    
    // Second pass: create the adoption status map for all tracts
    povertyData.forEach(row => {
        const censusTract = row["Census Tract"];
        if (censusTract && censusTract.trim()) {
            const tractId = censusTract.trim();
            
            // Check if this tract is in our adoptedTracts set
            const isAdopted = adoptedTracts.has(tractId);
            
            // Create the adoption status info
            adoptionStatusMap[tractId] = {
                status: isAdopted ? "adopted" : "not_adopted",
                inCsv: true, // This tract is in the CSV
                adoptedBy: isAdopted ? (row["Adopted by"] || "Unknown") : "N/A",
                churches: row["Churches"] || "N/A",
                nonProfits: row["Non-Profits"] || "N/A",
                localBusiness: row["Local Business"] || "N/A"
            };
        }
    });
    
    // Store the sets for use in the renderer
    adoptionStatusMap.__meta = {
        allCsvTracts: Array.from(allCsvTracts),
        adoptedTracts: Array.from(adoptedTracts)
    };
    
    console.log(`Created adoption status map with ${Object.keys(adoptionStatusMap).length - 1} tracts`); // -1 for __meta
    
    return adoptionStatusMap;
}
  
/**
 * Creates a renderer for the GeoJSON layer based on adoption status
 * @param {Object} adoptionStatusMap - Map of tract IDs to adoption status info
 * @returns {Object} ArcGIS renderer object
 */
export function createAdoptionStatusRenderer(adoptionStatusMap) {
    // Create a unique value renderer that will color features based on their GEOID
    const renderer = {
        type: "unique-value",
        field: "GEOID", // Use GEOID as the lookup field
        defaultSymbol: {
            type: "simple-fill",
            color: "rgba(255, 69, 58, 0.4)", // Light red for tracts NOT in CSV
            outline: {
                color: "black", 
                width: 0.5,
            },
        },
        uniqueValueInfos: []
    };
    
    // Add entries for adopted tracts (green)
    Object.entries(adoptionStatusMap).forEach(([tractId, statusInfo]) => {
        // Skip the metadata entry
        if (tractId === "__meta") return;
        
        if (statusInfo.status === "adopted") {
            renderer.uniqueValueInfos.push({
                value: tractId,
                symbol: {
                    type: "simple-fill",
                    color: "rgba(34, 197, 94, 0.4)", // Light green for adopted
                    outline: {
                        color: "black",
                        width: 0.5,
                    },
                }
            });
        } else if (statusInfo.inCsv) {
            // For tracts in CSV but not adopted (slightly different red)
            renderer.uniqueValueInfos.push({
                value: tractId,
                symbol: {
                    type: "simple-fill",
                    color: "rgba(255, 99, 71, 0.4)", // Tomato red for not adopted but in CSV
                    outline: {
                        color: "black",
                        width: 0.5,
                    },
                }
            });
        }
    });
    
    return renderer;
}
  
/**
 * Updates a popup template to display adoption status
 * @param {Object} originalTemplate - Original popup template
 * @param {Object} adoptionStatusMap - Map of tract IDs to adoption status
 * @returns {Object} Updated popup template
 */
export function createAdoptionStatusPopupTemplate(originalTemplate, adoptionStatusMap) {
    const originalContent = originalTemplate.content;
    const idField = "GEOID"; // Use GEOID for census tracts
    const meta = adoptionStatusMap.__meta || { allCsvTracts: [] };
    const allCsvTractsSet = new Set(meta.allCsvTracts);
    
    return {
        ...originalTemplate,
        content: (feature) => {
            // Get the original content
            let content = typeof originalContent === "function" 
                ? originalContent(feature) 
                : originalContent || "";
                
            // Get the feature ID
            const featureId = feature.graphic.attributes[idField] || 
                            feature.graphic.attributes.NAME;
            
            // Get the tract number/name
            const tractName = feature.graphic.attributes.NAMELSAD || "Unknown Tract";
            
            // Look up adoption status and determine if in CSV
            let adoptionStatus = "not_adopted";
            let inCsv = false;
            let adoptedBy = "N/A";
            let churches = "N/A";
            let nonProfits = "N/A";
            let localBusiness = "N/A";
            
            if (featureId && adoptionStatusMap[featureId]) {
                adoptionStatus = adoptionStatusMap[featureId].status;
                inCsv = adoptionStatusMap[featureId].inCsv;
                adoptedBy = adoptionStatusMap[featureId].adoptedBy;
                churches = adoptionStatusMap[featureId].churches;
                nonProfits = adoptionStatusMap[featureId].nonProfits;
                localBusiness = adoptionStatusMap[featureId].localBusiness;
            } else {
                // If not explicitly in the adoptionStatusMap, check if in CSV list
                inCsv = allCsvTractsSet.has(featureId);
            }
            
            // Create styled adoption status HTML with appropriate message
            let adoptionStatusHtml = "";
            if (adoptionStatus === "adopted") {
                adoptionStatusHtml = `<span style="background-color: rgba(34, 197, 94, 0.2); color: green; font-weight: bold; padding: 2px 6px; border-radius: 4px;">Adopted</span>`;
            } else if (inCsv) {
                adoptionStatusHtml = `<span style="background-color: rgba(255, 99, 71, 0.2); color: tomato; font-weight: bold; padding: 2px 6px; border-radius: 4px;">Not Adopted (In CSV)</span>`;
            } else {
                adoptionStatusHtml = `<span style="background-color: rgba(255, 69, 58, 0.2); color: red; font-weight: bold; padding: 2px 6px; border-radius: 4px;">Not In CSV</span>`;
            }
            
            // Make sure the tract name is displayed prominently
            if (!content.includes(`<h3>${tractName}</h3>`)) {
                content = `<h3>${tractName}</h3>` + content;
            }
            
            // Replace placeholders with actual values
            if (content.includes('<span id="adoption-status-placeholder"></span>')) {
                content = content.replace('<span id="adoption-status-placeholder"></span>', adoptionStatusHtml);
            }
            
            if (content.includes('<span id="adopted-by-placeholder"></span>')) {
                content = content.replace('<span id="adopted-by-placeholder"></span>', adoptedBy);
            }
            
            // Replace other placeholders if they exist
            if (content.includes('<span id="churches-placeholder"></span>')) {
                content = content.replace('<span id="churches-placeholder"></span>', churches);
            }
            
            if (content.includes('<span id="nonprofits-placeholder"></span>')) {
                content = content.replace('<span id="nonprofits-placeholder"></span>', nonProfits);
            }
            
            if (content.includes('<span id="business-placeholder"></span>')) {
                content = content.replace('<span id="business-placeholder"></span>', localBusiness);
            }
            
            return content;
        }
    };
}
  
// Create a named export to satisfy linting
const adoptionStatusUtils = {
    isTractInList,
    processAdoptionStatus,
    createAdoptionStatusRenderer,
    createAdoptionStatusPopupTemplate
};
  
export default adoptionStatusUtils;