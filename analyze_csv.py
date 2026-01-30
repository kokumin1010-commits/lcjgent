import pandas as pd
import json

# Read the Excel file
df = pd.read_excel('/home/ubuntu/task-automation-agent/Creator-Live-Performance_20260130051829.xlsx')

# Display all columns
print("=== Columns ===")
print(df.columns.tolist())

# Display first few rows
print("\n=== First 5 rows ===")
print(df.head().to_string())

# Filter for 8/31 data
print("\n=== All data (looking for 8/31) ===")
print(df.to_string())

# Check data types
print("\n=== Data Types ===")
print(df.dtypes)
