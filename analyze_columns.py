import pandas as pd

# Read the Excel file
df = pd.read_excel('/home/ubuntu/task-automation-agent/Creator-Live-Performance_20260130051829.xlsx', header=None)

# Display all rows and columns
print("=== Raw Excel Data (first 5 rows) ===")
for i in range(min(5, len(df))):
    print(f"\nRow {i}:")
    for j, val in enumerate(df.iloc[i]):
        print(f"  Column {j}: {val}")

# Find the header row
print("\n=== Looking for header row ===")
for i in range(len(df)):
    row = df.iloc[i]
    for j, val in enumerate(row):
        if 'Start time' in str(val) or '日時' in str(val):
            print(f"Found header at row {i}, column {j}: {val}")
            print(f"Full header row: {list(row)}")
            break

# Show 8/31 data with column indices
print("\n=== 8/31 Data with Column Indices ===")
for i in range(len(df)):
    row = df.iloc[i]
    date_val = str(row.iloc[1]) if len(row) > 1 else ''
    if '2025-08-31' in date_val:
        print(f"\nRow {i} (8/31 data):")
        for j, val in enumerate(row):
            print(f"  Column {j}: {val}")
