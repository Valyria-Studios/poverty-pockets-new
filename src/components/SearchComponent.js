import React from "react";

const SearchComponent = ({
    searchField,
    setSearchField,
    searchValue,
    setSearchValue,
    onSearch,
    selectedLayer,
    searchStatus,
    toggleLayer
}) => (
    <div style={{ position: "absolute", bottom: "100px", left: "20px", zIndex: 1000 }}>
        <form
            onSubmit={onSearch}
            style={{
                display: "flex",
                flexDirection: "column",
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "10px",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                width: "250px",
            }}
        >
            <label style={{ marginBottom: "10px", fontWeight: "bold" }}>
                Search By:
                <select
                    value={searchField}
                    onChange={(e) => setSearchField(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "10px",
                        margin: "10px 0",
                        borderRadius: "5px",
                        border: "1px solid #ccc",
                    }}
                >
                    <option value="">-- Please select an option --</option>
                    {selectedLayer === "censusTracts" ? (
                        <>
                            <option value="P1_001N">Total Population</option>
                            <option value="DP03_0004PE">Employment Rate</option>
                            <option value="DP02_0001E">Total Households</option>
                            <option value="S1901_C01_012E">Median Household Income</option>
                        </>
                    ) : (
                        <>
                            <option value="ZIP_CODE">Zip Code</option>
                            <option value="PO_NAME">Post Office Name</option>
                        </>
                    )}
                </select>
            </label>

            <label style={{ marginBottom: "10px", fontWeight: "bold" }}>
                Value:
                <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Enter search value"
                    style={{
                        width: "100%",
                        padding: "10px",
                        margin: "10px 0",
                        borderRadius: "5px",
                        border: "1px solid #ccc",
                    }}
                />
            </label>

            <button
                type="submit"
                style={{
                    padding: "10px",
                    backgroundColor: "#007BFF",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    marginBottom: "15px"
                }}
                disabled={!searchField || !searchValue.trim()}
            >
                Search
            </button>

            {/* Layer Toggle Button */}
            <button
                type="button"
                onClick={toggleLayer}
                style={{
                    padding: "10px",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontWeight: "bold",
                }}
            >
                {selectedLayer === "censusTracts"
                    ? "Switch to Zip Code View"
                    : "Switch to Census Tract View"}
            </button>

            {searchStatus && (
                <div style={{ marginTop: "10px", color: "red", fontWeight: "bold" }}>
                    {searchStatus}
                </div>
            )}
        </form>
    </div>
);

export default SearchComponent;