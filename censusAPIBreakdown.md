# Here is a breakdown of the Census API Calling

## Data Dictionary

Here are the links and variables associated with each data on a profile:

- Any data from the 2020 Decennial Census (**P#** and **H#**) will use the variables from this link:

  - https://api.census.gov/data/2020/dec/pl/variables.html

- Any data that uses the **S###** variable code from the 2023 American Community Survey 5-Year Estimates use variables from this link:

  - https://api.census.gov/data/2023/acs/acs5/subject/variables.html

- Any data that uses the **DP###** variable code from the 2023 American Community Survey 5-Year Estimates use variables from this link:
  - https://api.census.gov/data/2023/acs/acs5/profile/variables.html

## Example of a variable

This is an example of a tract pulling a variable from each link above:

### Tract being used: [Census Tract 3530.01; Contra Costa County; California](https://data.census.gov/profile/Census_Tract_3530.01;_Contra_Costa_County;_California?g=1400000US06013353001, "Contra Costa Tract")

1. Total Population:

   - https://api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=tract:353001&in=state:06&in=county:013

2. Median Household Income:

   - https://api.census.gov/data/2023/acs/acs5/subject?get=NAME,S1901_C01_012E&for=tract:353001&in=state:06&in=county:013

3. Employment Rate:
   - https://api.census.gov/data/2023/acs/acs5/profile?get=NAME,DP03_0004PE&for=tract:353001&in=state:06&in=county:013