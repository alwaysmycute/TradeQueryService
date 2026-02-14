-- ============================================================
-- Table: trade_yearly_share_by_countries
-- 各國年度貿易市佔率 — 含金額佔比與重量佔比
-- Source: trade_yearly_by_countries + 自身彙總（台灣年度總額）
-- ============================================================

CREATE OR REPLACE TABLE trade_yearly_share_by_countries AS
WITH yearly_totals AS (
    -- 計算台灣每年每產業的總貿易額/總重量（跨所有國家加總）
    SELECT
        YEAR,
        TRADE_FLOW,
        INDUSTRY_ID,
        SUM(TRADE_VALUE_USD_AMT)  AS TOTAL_TRADE_VALUE_USD_AMT,
        SUM(TRADE_WEIGHT)         AS TOTAL_TRADE_WEIGHT
    FROM trade_yearly_by_countries
    GROUP BY YEAR, TRADE_FLOW, INDUSTRY_ID
)
SELECT
    c.YEAR,
    c.TRADE_FLOW,
    c.COUNTRY_ID,
    c.COUNTRY_COMM_ZH,
    c.AREA_ID,
    c.AREA_NM,

    -- 該國金額 & 台灣總額 & 佔比
    c.TRADE_VALUE_USD_AMT,
    t.TOTAL_TRADE_VALUE_USD_AMT,
    CASE WHEN t.TOTAL_TRADE_VALUE_USD_AMT IS NULL OR t.TOTAL_TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE c.TRADE_VALUE_USD_AMT / t.TOTAL_TRADE_VALUE_USD_AMT
    END AS SHARE_RATIO_TRADE_VALUE_USD,

    -- 該國重量 & 台灣總重量 & 佔比
    c.TRADE_WEIGHT,
    t.TOTAL_TRADE_WEIGHT,
    CASE WHEN t.TOTAL_TRADE_WEIGHT IS NULL OR t.TOTAL_TRADE_WEIGHT = 0 THEN NULL
         ELSE c.TRADE_WEIGHT / t.TOTAL_TRADE_WEIGHT
    END AS SHARE_RATIO_TRADE_WEIGHT,

    c.UNIT_PRICE_USD_PER_KG,
    c.ETL_DT,
    c.INDUSTRY_ID,
    c.INDUSTRY,
    c.HS_CODE_GROUP

FROM trade_yearly_by_countries c
INNER JOIN yearly_totals t
    ON  c.YEAR         = t.YEAR
    AND c.TRADE_FLOW   = t.TRADE_FLOW
    AND c.INDUSTRY_ID  = t.INDUSTRY_ID
