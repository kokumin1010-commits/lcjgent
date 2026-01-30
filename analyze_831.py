import pandas as pd

# Read the Excel file with proper header
df = pd.read_excel('/home/ubuntu/task-automation-agent/Creator-Live-Performance_20260130051829.xlsx', header=1)

# Display columns
print("=== Columns ===")
print(df.columns.tolist())

# Filter for 8/31 data
print("\n=== 8/31 Data ===")
for idx, row in df.iterrows():
    date_str = str(row.iloc[1])  # 日時 column
    if '2025-08-31' in date_str:
        print(f"\nRow {idx}:")
        print(f"  LIVE配信: {row.iloc[0]}")
        print(f"  日時: {row.iloc[1]}")
        print(f"  配信時間(秒): {row.iloc[2]}")
        print(f"  起因GMV: {row.iloc[3]}")
        print(f"  GMV: {row.iloc[4]}")
        print(f"  販売数: {row.iloc[5]}")
        print(f"  視聴数: {row.iloc[6]}")

# Also show the raw data for 8/31
print("\n=== Raw 8/31 rows ===")
for idx, row in df.iterrows():
    date_str = str(row.iloc[1])
    if '2025-08-31' in date_str:
        print(row.to_dict())
