import axios from "axios";

const CENSUS_API_BASE = "https://api.census.gov/data";

const apiKey = process.env.REACT_APP_CENSUS_API_KEY;

// Helper function to build the API URL
export const buildCensusAPIUrl = (year, dataset, variables, state, county, tract) => {
  const base = `${CENSUS_API_BASE}/${year}/${dataset}`;
  const params = `get=${variables.join(",")}&for=tract:${tract}&in=state:${state}&in=county:${county}&key=${apiKey}`;
  return `${base}?${params}`;
};

// Function to fetch data
export const fetchCensusData = async (year, dataset, variables, state, county, tract) => {
  try {
    const url = buildCensusAPIUrl(year, dataset, variables, state, county, tract);
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching Census data:", error);
    throw error;
  }
};
