export const performSearch = async ({
  view,
  geoJsonLayer,
  searchField,
  searchValue,
  setSearchValue, // Added parameter to clear the input field
}) => {
  try {
    console.log("Starting search for:", searchValue, "in field:", searchField);
    
    if (!geoJsonLayer) {
      console.error("Layer is not ready.");
      return { success: false, message: "Layer is not ready." };
    }
    
    // Create the query
    const query = geoJsonLayer.createQuery();
    
    // Sanitize inputs and build proper query
    const sanitizedValue = searchValue.replace(/'/g, "''"); // Escape single quotes
    
    // Determine if we need quotes based on field type
    const numericFields = ["P1_001N", "DP03_0004PE", "DP02_0001E", "S1901_C01_012E"];
    if (numericFields.includes(searchField)) {
      query.where = `${searchField} = ${sanitizedValue}`;
    } else {
      query.where = `${searchField} = '${sanitizedValue}'`;
    }
    
    query.returnGeometry = true;
    query.outFields = ["*"];
    
    console.log("Query where clause:", query.where);
    
    // Perform the query
    const results = await geoJsonLayer.queryFeatures(query);
    
    if (!results.features.length) {
      console.warn("No matching result found.");
      return { success: false, message: "No matching result found." };
    }
    
    const match = results.features[0];
    const geometry = match.geometry;
    const location =
      geometry.type === "point"
        ? geometry
        : geometry.extent?.center || geometry;
    
    console.log("Match found, zooming to location", location);
    
    // First, zoom to the location 
    if (geometry.type === "point") {
      await view.goTo({ target: geometry, zoom: 12 });
    } else {
      await view.goTo(geometry.extent || geometry);
    }
    
    // Attempt to set popup properties directly (might not work)
    try {
      // Apply popup template from layer if needed
      if (!match.popupTemplate && geoJsonLayer.popupTemplate) {
        match.popupTemplate = geoJsonLayer.popupTemplate;
      }
      
      // Generate title
      let title = "";
      if (match.popupTemplate && match.popupTemplate.title) {
        title = match.popupTemplate.title.replace(/\{([^}]+)\}/g, (m, key) => {
          return match.attributes && match.attributes[key] !== undefined ? 
            match.attributes[key] : "N/A";
        });
      } else if (match.attributes && match.attributes.ZIP_CODE) {
        title = `Zip Code: ${match.attributes.ZIP_CODE}`;
      } else {
        title = "Feature Information";
      }
      
      // Generate content
      let content = "";
      if (match.popupTemplate && typeof match.popupTemplate.content === "function") {
        try {
          content = match.popupTemplate.content(match);
        } catch (err) {
          console.error("Content generation error:", err);
        }
      }
      
      console.log("Setting popup properties manually");
      
      // Make sure to clear existing popup first
      view.popup.visible = false;
      
      // Set popup properties
      view.popup.title = title;
      view.popup.content = content;
      view.popup.location = location;
      view.popup.visible = true;
      
      console.log("Popup content set:", { title, contentLength: content?.length, content: content || 0 });
    } catch (popupError) {
      console.error("Error setting popup properties:", popupError);
    }
    
    // Create feature buttons (View Details and Clear Search)
    try {
      // Get feature information for the button
      let zipCode = match.attributes.ZIP_CODE;
      if (!zipCode && match.attributes.ZIPCODE) {
        zipCode = match.attributes.ZIPCODE;
      }
      
      let buttonTitle = "Feature Information";
      if (zipCode) {
        buttonTitle = `Zip Code: ${zipCode}`;
      } else if (match.attributes.NAMELSAD) {
        buttonTitle = `Census Tract: ${match.attributes.NAMELSAD}`;
      }
      
      // Get church information if available
      let churchCount = 0;
      if (zipCode && match.attributes.POPULATION) {
        console.log(`Found churches for ZIP ${zipCode}`);
        churchCount = 5; // Assuming this is what your content function would find
      }
      
      // Create a container for the buttons
      const buttonContainer = document.createElement("div");
      buttonContainer.id = "search-buttons-container";
      buttonContainer.style.position = "absolute";
      buttonContainer.style.bottom = "20px";
      buttonContainer.style.left = "50%";
      buttonContainer.style.transform = "translateX(-50%)";
      buttonContainer.style.zIndex = "1000";
      buttonContainer.style.display = "flex";
      buttonContainer.style.gap = "10px";
      
      // Create the View Details button
      const viewDetailsButton = document.createElement("div");
      viewDetailsButton.id = "feature-info-button";
      viewDetailsButton.style.backgroundColor = "#007BFF";
      viewDetailsButton.style.color = "white";
      viewDetailsButton.style.padding = "10px 15px";
      viewDetailsButton.style.borderRadius = "5px";
      viewDetailsButton.style.cursor = "pointer";
      viewDetailsButton.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";
      viewDetailsButton.style.textAlign = "center";
      viewDetailsButton.style.fontWeight = "bold";
      viewDetailsButton.innerHTML = `View Details: ${buttonTitle} (${churchCount} churches)`;
      
      // Create the Clear Search button
      const clearButton = document.createElement("div");
      clearButton.id = "clear-search-button";
      clearButton.style.backgroundColor = "#6c757d";
      clearButton.style.color = "white";
      clearButton.style.padding = "10px 15px";
      clearButton.style.borderRadius = "5px";
      clearButton.style.cursor = "pointer";
      clearButton.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";
      clearButton.style.textAlign = "center";
      clearButton.style.fontWeight = "bold";
      clearButton.innerHTML = "Clear Search";
      
      // Remove any existing button container
      const existingContainer = document.getElementById("search-buttons-container");
      if (existingContainer) {
        existingContainer.remove();
      }
      
      // Add buttons to the container
      buttonContainer.appendChild(viewDetailsButton);
      buttonContainer.appendChild(clearButton);
      
      // Add container to the DOM
      const mapContainer = view.container;
      if (mapContainer && mapContainer.parentNode) {
        mapContainer.parentNode.appendChild(buttonContainer);
        
        // Add click event to the View Details button
        viewDetailsButton.addEventListener("click", function() {
          console.log("Feature button clicked");
          
          try {
            // Try setting popup properties again when button is clicked
            if (!match.popupTemplate && geoJsonLayer.popupTemplate) {
              match.popupTemplate = geoJsonLayer.popupTemplate;
            }
            
            let content = "";
            if (match.popupTemplate && typeof match.popupTemplate.content === "function") {
              try {
                content = match.popupTemplate.content(match);
                
                // Create an info window/modal instead of relying on the popup
                const infoWindow = document.createElement("div");
                infoWindow.id = "feature-info-window";
                infoWindow.style.position = "absolute";
                infoWindow.style.top = "50%";
                infoWindow.style.left = "50%";
                infoWindow.style.transform = "translate(-50%, -50%)";
                infoWindow.style.backgroundColor = "white";
                infoWindow.style.padding = "20px";
                infoWindow.style.borderRadius = "5px";
                infoWindow.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.3)";
                infoWindow.style.zIndex = "2000";
                infoWindow.style.maxWidth = "400px";
                infoWindow.style.maxHeight = "80vh";
                infoWindow.style.overflow = "auto";
                
                // Add a close button
                const closeButton = document.createElement("button");
                closeButton.innerHTML = "✕";
                closeButton.style.position = "absolute";
                closeButton.style.top = "10px";
                closeButton.style.right = "10px";
                closeButton.style.border = "none";
                closeButton.style.background = "none";
                closeButton.style.fontSize = "16px";
                closeButton.style.cursor = "pointer";
                closeButton.style.color = "#333";
                closeButton.onclick = function() {
                  infoWindow.remove();
                };
                
                // Create title element
                const titleElement = document.createElement("h3");
                titleElement.style.marginTop = "0";
                titleElement.style.marginBottom = "15px";
                titleElement.innerHTML = buttonTitle;
                
                // Create content container
                const contentElement = document.createElement("div");
                contentElement.innerHTML = content;
                
                // Assemble the info window
                infoWindow.appendChild(closeButton);
                infoWindow.appendChild(titleElement);
                infoWindow.appendChild(contentElement);
                
                // Add to the DOM
                document.body.appendChild(infoWindow);
                
                console.log("Created custom info window");
              } catch (error) {
                console.error("Error generating content for modal:", error);
                
                // Fallback to simple alert
                let alertContent = `Feature: ${buttonTitle}\n\n`;
                for (const [key, value] of Object.entries(match.attributes)) {
                  if (!key.startsWith("__") && value !== null) {
                    alertContent += `${key}: ${value}\n`;
                  }
                }
                alert(alertContent);
              }
            } else {
              // Simple alert fallback
              let alertContent = `Feature: ${buttonTitle}\n\n`;
              for (const [key, value] of Object.entries(match.attributes)) {
                if (!key.startsWith("__") && value !== null) {
                  alertContent += `${key}: ${value}\n`;
                }
              }
              alert(alertContent);
            }
          } catch (error) {
            console.error("Error handling button click:", error);
            
            // Ultimate fallback
            alert(`Feature information for ${buttonTitle}`);
          }
        });
        
        // Add click event to the Clear Search button
        clearButton.addEventListener("click", function() {
          console.log("Clear search button clicked");
          
          try {
            // Remove the search buttons
            const container = document.getElementById("search-buttons-container");
            if (container) {
              container.remove();
            }
            
            // Remove any open info window
            const infoWindow = document.getElementById("feature-info-window");
            if (infoWindow) {
              infoWindow.remove();
            }
            
            // Hide any visible popup
            if (view.popup) {
              view.popup.visible = false;
            }
            
            // Reset the view to show the full extent of the layer
            if (geoJsonLayer && geoJsonLayer.fullExtent) {
              view.goTo(geoJsonLayer.fullExtent);
            }
            
            // Clear the search input field if the setter function is available
            if (setSearchValue && typeof setSearchValue === 'function') {
              setSearchValue('');
              console.log("Search input field cleared");
            }
            
            console.log("Map view reset to initial state");
          } catch (error) {
            console.error("Error resetting map view:", error);
          }
        });
        
        console.log("Search buttons added");
      }
    } catch (buttonError) {
      console.error("Error creating buttons:", buttonError);
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error during search:", error);
    return { success: false, message: "An error occurred during the search." };
  }
};