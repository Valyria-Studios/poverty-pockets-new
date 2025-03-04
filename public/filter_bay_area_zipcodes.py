import json
from shapely.geometry import shape, box

# File paths
input_file = "./public/ALLZipCodes.geojson"
output_file = "./public/BayAreaZipCodes.geojson"

# Define Bay Area bounding box (minx, miny, maxx, maxy)
bay_area_bbox = box(-123.1, 36.9, -121.5, 38.6)

def filter_geojson(input_file, output_file, bounding_box):
    try:
        # Load the GeoJSON file
        with open(input_file, "r") as f:
            data = json.load(f)

        # Filter features within the bounding box
        filtered_features = []
        for feature in data.get("features", []):
            geometry = feature.get("geometry")
            properties = feature.get("properties", {})
            if geometry:
                geom_shape = shape(geometry)
                if bounding_box.intersects(geom_shape):
                    # Add custom properties for popup
                    zip_code = properties.get("GEOID", "Unknown ZIP Code")
                    region_name = properties.get("NAMELSAD", "Unknown Region")
                    properties["popup_zip_code"] = zip_code
                    properties["popup_region_name"] = region_name

                    # Update the feature properties
                    feature["properties"] = properties
                    filtered_features.append(feature)

        # Prepare the filtered GeoJSON
        filtered_geojson = {
            "type": "FeatureCollection",
            "features": filtered_features,
        }

        # Save the filtered GeoJSON
        with open(output_file, "w") as f:
            json.dump(filtered_geojson, f, indent=2)

        print(f"Filtered GeoJSON saved to {output_file}")

    except Exception as e:
        print(f"Error: {e}")

# Run the filter function
filter_geojson(input_file, output_file, bay_area_bbox)
