-- ============================================================
-- Table: trade_yearly_growth_totals
-- 年度貿易成長率（總體）— 含金額/重量/單價三維度的 YoY 成長率
-- Source: trade_yearly_totals
-- ============================================================

CREATE OR REPLACE TABLE trade_yearly_growth_totals AS
SELECT
    cur.YEAR,
    cur.TRADE_FLOW,
    cur.INDUSTRY_ID,
    cur.INDUSTRY,

    -- 當期值
    cur.TRADE_VALUE_USD_AMT,
    cur.TRADE_WEIGHT,
    cur.UNIT_PRICE_USD_PER_KG,

    -- 金額 YoY
    prev.TRADE_VALUE_USD_AMT                              AS PREV_YEAR_TRADE_VALUE_USD_AMT,
    cur.TRADE_VALUE_USD_AMT - prev.TRADE_VALUE_USD_AMT    AS YOY_DELTA_TRADE_VALUE_USD_AMT,
    CASE WHEN prev.TRADE_VALUE_USD_AMT IS NULL OR prev.TRADE_VALUE_USD_AMT = 0 THEN NULL
         ELSE (cur.TRADE_VALUE_USD_AMT - prev.TRADE_VALUE_USD_AMT) / prev.TRADE_VALUE_USD_AMT
    END                                                   AS YOY_GROWTH_RATE_TRADE_VALUE_USD,

    -- 重量 YoY
    prev.TRADE_WEIGHT                                     AS PREV_YEAR_TRADE_WEIGHT,
    cur.TRADE_WEIGHT - prev.TRADE_WEIGHT                  AS YOY_DELTA_TRADE_WEIGHT,
    CASE WHEN prev.TRADE_WEIGHT IS NULL OR prev.TRADE_WEIGHT = 0 THEN NULL
         ELSE (cur.TRADE_WEIGHT - prev.TRADE_WEIGHT) / prev.TRADE_WEIGHT
    END                                                   AS YOY_GROWTH_RATE_TRADE_WEIGHT,

    -- 單價 YoY
    prev.UNIT_PRICE_USD_PER_KG                            AS PREV_YEAR_UNIT_PRICE_USD_PER_KG,
    cur.UNIT_PRICE_USD_PER_KG - prev.UNIT_PRICE_USD_PER_KG AS YOY_DELTA_UNIT_PRICE_USD_PER_KG,
    CASE WHEN prev.UNIT_PRICE_USD_PER_KG IS NULL OR prev.UNIT_PRICE_USD_PER_KG = 0 THEN NULL
         ELSE (cur.UNIT_PRICE_USD_PER_KG - prev.UNIT_PRICE_USD_PER_KG) / prev.UNIT_PRICE_USD_PER_KG
    END                                                   AS YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG,

    cur.ETL_DT

FROM trade_yearly_totals cur
LEFT JOIN trade_yearly_totals prev
    ON  cur.TRADE_FLOW   = prev.TRADE_FLOW
    AND cur.INDUSTRY_ID  = prev.INDUSTRY_ID
    AND cur.YEAR         = prev.YEAR + 1
