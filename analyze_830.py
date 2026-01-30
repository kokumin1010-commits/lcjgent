import pandas as pd

# Read the Excel file
df = pd.read_excel('/home/ubuntu/task-automation-agent/Creator-Live-Performance_20260130051829.xlsx', header=None)

# Find the header row and data
print("=== Looking for 8/30 data ===")
for i in range(len(df)):
    row = df.iloc[i]
    date_val = str(row.iloc[1]) if len(row) > 1 else ''
    if '2025-08-30' in date_val:
        print(f"\nRow {i} (8/30 data):")
        print(f"  Column 0 (Livestream): {row.iloc[0]}")
        print(f"  Column 1 (Start time): {row.iloc[1]}")
        print(f"  Column 2 (Duration): {row.iloc[2]} seconds = {int(row.iloc[2])/60:.1f} minutes")
        print(f"  Column 3 (Gross revenue): {row.iloc[3]}")
        print(f"  Column 12 (Viewers): {row.iloc[12]}")
        print(f"  Column 16 (Likes): {row.iloc[16]}")

print("\n=== All data with dates ===")
for i in range(3, min(10, len(df))):  # Skip header rows
    row = df.iloc[i]
    print(f"Row {i}: Date={row.iloc[1]}, Duration={row.iloc[2]}s, Revenue={row.iloc[3]}")
