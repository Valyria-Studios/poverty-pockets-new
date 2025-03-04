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
    
    // Create the query
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
    const location =
      geometry.type === "point"
        ? geometry
        : geometry.extent?.center || geometry;
    
    console.log("Zooming to location:", location);
    if (geometry.type === "point") {
      await view.goTo({ target: geometry, zoom: 12 });
    } else {
      await view.goTo(geometry.extent || geometry);
    }
    
    // Open the popup using the feature’s own popupTemplate
    view.popup.open({
      features: [match],
      location: location,
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error during search:", error);
    return { success: false, message: "An error occurred during the search." };
  }
};
