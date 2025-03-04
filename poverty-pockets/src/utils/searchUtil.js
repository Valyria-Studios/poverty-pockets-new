export const performSearch = async ({
    view,
    geoJsonLayer,
    searchField,
    searchValue,
  }) => {
    try {
      if (!geoJsonLayer) {
        console.error("Layer is not ready.");
        return { success: false, message: "Layer is not ready." };
      }
  
      console.log("Searching for:", searchValue, "in field:", searchField);
  
      // Create a query
      const query = geoJsonLayer.createQuery();
      query.where = `${searchField} = '${searchValue}'`;
      query.returnGeometry = true;
      query.outFields = ["*"];
  
      // Perform the query
      const results = await geoJsonLayer.queryFeatures(query);
  
      if (!results.features.length) {
        console.warn("No matching result found.");
        return { success: false, message: "No matching result found." };
      }
  
      const match = results.features[0];
      const geometry = match.geometry;
  
      // Debug log to check popup availability
      console.log("Checking view.popup:", view.popup);
  
      if (view.popup) {
        await view.goTo(geometry.extent || geometry);
        view.popup.open({
          features: [match],
          location: geometry.extent?.center || geometry,
        });
        return { success: true };
      } else {
        console.error("Popup is not available on the view.");
        return { success: false, message: "Popup is not available on the map view." };
      }
    } catch (error) {
      console.error("Error during search:", error);
      return { success: false, message: "An error occurred during the search." };
    }
  };
  