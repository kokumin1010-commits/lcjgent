export const EXHIBITION_EVENT_SLUG = "brand-booth-2026";
export const EXHIBITION_FLOOR_MAP_URL = "/api/exhibition/floor-map";
export const EXHIBITION_MAP_WIDTH = 1416;
export const EXHIBITION_MAP_HEIGHT = 609;

export type ExhibitionBoothType =
  | "t_standard"
  | "l_standard"
  | "premium_sponsor"
  | "title_sponsor"
  | "stage";

export type ExhibitionBoothDefinition = {
  code: string;
  type: ExhibitionBoothType;
  x: number;
  y: number;
  width: number;
  height: number;
  userSelectable: boolean;
  label?: string;
};

function booth(
  code: string,
  type: ExhibitionBoothType,
  x: number,
  y: number,
  width: number,
  height: number,
  userSelectable = true,
  label?: string
): ExhibitionBoothDefinition {
  return { code, type, x, y, width, height, userSelectable, label };
}

function topRow(): ExhibitionBoothDefinition[] {
  const positions: Array<[number, number]> = [
    [14, 44],
    [13, 137],
    [12, 229],
    [11, 321],
    [10, 490],
    [9, 582],
    [8, 674],
    [7, 766],
    [6, 858],
    [5, 950],
    [4, 1043],
    [3, 1135],
    [2, 1227],
    [1, 1319],
  ];
  return positions.map(([id, x]) =>
    booth(`T-${id}`, "t_standard", x, 4, 92, 62)
  );
}

function verticalSingleColumn(
  start: number,
  x: number
): ExhibitionBoothDefinition[] {
  return Array.from({ length: 5 }, (_, row) =>
    booth(`T-${start + row}`, "t_standard", x, 142 + row * 92.2, 59, 92.2)
  );
}

function verticalTwoColumn(
  start: number,
  x: number
): ExhibitionBoothDefinition[] {
  return Array.from({ length: 10 }, (_, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    return booth(
      `T-${start + index}`,
      "t_standard",
      x + col * 62,
      142 + row * 92.2,
      62,
      92.2
    );
  });
}

function lGrid(
  start: number,
  x: number,
  y: number
): ExhibitionBoothDefinition[] {
  return Array.from({ length: 6 }, (_, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    return booth(
      `L-${start + index}`,
      "l_standard",
      x + col * 62,
      y + row * 61.33,
      62,
      61.33
    );
  });
}

export const EXHIBITION_BOOTH_DEFINITIONS: ExhibitionBoothDefinition[] = [
  ...topRow(),
  ...verticalSingleColumn(15, 0),
  ...verticalTwoColumn(20, 120),
  ...verticalTwoColumn(30, 305),
  ...verticalTwoColumn(40, 490),
  ...verticalTwoColumn(50, 674),
  booth("T-60", "stage", 858, 142, 185, 184, false, "番組ステージ"),
  ...lGrid(1, 1104, 142),
  ...lGrid(7, 1288, 142),
  booth(
    "T-61",
    "premium_sponsor",
    858,
    419,
    62,
    184,
    false,
    "プレミアムスポンサー"
  ),
  booth(
    "T-62",
    "premium_sponsor",
    920,
    419,
    62,
    184,
    false,
    "プレミアムスポンサー"
  ),
  booth(
    "T-63",
    "title_sponsor",
    1042,
    419,
    186,
    184,
    false,
    "タイトルスポンサー"
  ),
  ...lGrid(13, 1288, 419),
];

export const EXHIBITION_BOOTH_TYPE_LABELS: Record<
  ExhibitionBoothType,
  { zh: string; ja: string }
> = {
  t_standard: { zh: "T 标准展位", ja: "T標準ブース" },
  l_standard: { zh: "L 品牌展位", ja: "Lブランドブース" },
  premium_sponsor: { zh: "高级赞助展位", ja: "プレミアムスポンサーブース" },
  title_sponsor: { zh: "冠名赞助展位", ja: "タイトルスポンサーブース" },
  stage: { zh: "节目舞台", ja: "番組ステージ" },
};

export function boothRectPercent(definition: ExhibitionBoothDefinition) {
  return {
    left: `${(definition.x / EXHIBITION_MAP_WIDTH) * 100}%`,
    top: `${(definition.y / EXHIBITION_MAP_HEIGHT) * 100}%`,
    width: `${(definition.width / EXHIBITION_MAP_WIDTH) * 100}%`,
    height: `${(definition.height / EXHIBITION_MAP_HEIGHT) * 100}%`,
  };
}
